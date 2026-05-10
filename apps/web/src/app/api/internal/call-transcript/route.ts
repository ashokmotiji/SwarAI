import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { scoreSentimentFromText } from "@/lib/sentiment";
import { scoreSentimentWithOpenAI } from "@/lib/sentiment-openai";
import { suggestPromptImprovement } from "@/lib/prompt-optimization";
import { dispatchCallCompletedWebhook } from "@/lib/webhook-outbound";

const BodySchema = z.object({
  callId: z.string().uuid(),
  roomName: z.string(),
  history: z.record(z.unknown()),
});

function historyToPlainText(history: Record<string, unknown>): string {
  try {
    const items = (history.items ?? history.messages ?? []) as unknown[];
    if (!Array.isArray(items)) return JSON.stringify(history).slice(0, 8000);
    return items
      .map((m) => {
        if (m && typeof m === "object" && "role" in m && "content" in m) {
          return `${(m as { role: string }).role}: ${String((m as { content: unknown }).content)}`;
        }
        return JSON.stringify(m);
      })
      .join("\n");
  } catch {
    return JSON.stringify(history).slice(0, 8000);
  }
}

export async function POST(req: Request) {
  const secret = process.env.SWARAI_INTERNAL_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-swarai-internal") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const text = historyToPlainText(body.history);
  let { label, score } = scoreSentimentFromText(text);
  const aiSent = await scoreSentimentWithOpenAI(text);
  if (aiSent) {
    label = aiSent.label;
    score = aiSent.score;
  }

  const { error: upErr } = await supabase
    .from("calls")
    .update({
      transcript: body.history as never,
      status: "completed",
      ended_at: new Date().toISOString(),
      sentiment_score: score,
    })
    .eq("id", body.callId);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  await supabase.from("sentiment_events").insert({
    call_id: body.callId,
    phase: "post",
    label,
    score,
  });

  const { data: call } = await supabase
    .from("calls")
    .select("agent_id, org_id")
    .eq("id", body.callId)
    .single();

  if (call?.org_id) {
    const { data: orgRow } = await supabase.from("organizations").select("settings").eq("id", call.org_id).single();
    await dispatchCallCompletedWebhook(orgRow?.settings as Record<string, unknown> | null, {
      event: "call.completed",
      callId: body.callId,
      roomName: body.roomName,
      transcriptPreview: text.slice(0, 4000),
      sentiment: { label, score },
    });
  }

  if (call?.agent_id) {
    const { count } = await supabase
      .from("calls")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", call.agent_id)
      .eq("status", "completed");

    const n = count ?? 0;
    if (n > 0 && n % 10 === 0) {
      const { data: agent } = await supabase
        .from("agents")
        .select("system_prompt")
        .eq("id", call.agent_id)
        .single();
      const { data: recent } = await supabase
        .from("calls")
        .select("transcript")
        .eq("agent_id", call.agent_id)
        .eq("status", "completed")
        .order("ended_at", { ascending: false })
        .limit(10);

      const samples =
        recent?.map((r) => historyToPlainText((r.transcript as Record<string, unknown>) ?? {})) ?? [];

      const suggestion = await suggestPromptImprovement({
        currentPrompt: agent?.system_prompt ?? "",
        transcriptSamples: samples,
      });

      await supabase.from("prompt_suggestions").insert({
        agent_id: call.agent_id,
        call_sample_size: 10,
        suggestion,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
