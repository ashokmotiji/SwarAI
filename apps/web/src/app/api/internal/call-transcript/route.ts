import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { scoreSentimentFromText } from "@/lib/sentiment";
import { scoreSentimentWithOpenAI } from "@/lib/sentiment-openai";
import { suggestPromptImprovement } from "@/lib/prompt-optimization";
import { dispatchCallCompletedWebhook } from "@/lib/webhook-outbound";
import { syncToCrm } from "@/lib/crm-sync";
import { generatePerformanceScorecard, generateCallSummary, extractOrderValue } from "@/lib/ai-analysis";
import { extractCustomerContext } from "@/lib/context-learning";

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
  const secret = process.env.SWARSALES_INTERNAL_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-swarsales-internal") !== secret) {
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

  const { data: currentCall } = await supabase.from("calls").select("started_at").eq("id", body.callId).single();
  const durationSeconds = currentCall?.started_at ? Math.floor((Date.now() - new Date(currentCall.started_at).getTime()) / 1000) : 0;
  const orderValue = await extractOrderValue(text);

  const { error: upErr } = await supabase
    .from("calls")
    .update({
      transcript: body.history as never,
      status: "completed",
      ended_at: new Date().toISOString(),
      sentiment_score: score,
      sentiment_label: label,
      duration_seconds: durationSeconds,
      order_value: orderValue,
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
    // Generate AI scorecard
    const scorecard = await generatePerformanceScorecard(text);
    if (scorecard) {
      await supabase.from("performance_scorecards").insert({
        call_id: body.callId,
        agent_id: call.agent_id,
        org_id: call.org_id,
        ...scorecard
      });
    }

    const summary = await generateCallSummary(text);

    // Update customer context
    const { data: callPlus } = await supabase.from("calls").select("customer_phone").eq("id", body.callId).single();
    if (callPlus?.customer_phone) {
      const { data: existingCtx } = await supabase
        .from("customer_contexts")
        .select("context_data")
        .eq("org_id", call.org_id)
        .eq("customer_phone", callPlus.customer_phone)
        .maybeSingle();

      const newCtx = await extractCustomerContext(text, (existingCtx?.context_data as Record<string, any>) || {});

      await supabase.from("customer_contexts").upsert({
        org_id: call.org_id,
        customer_phone: callPlus.customer_phone,
        context_data: newCtx,
        last_interaction_at: new Date().toISOString()
      });
    }

    const { data: orgRow } = await supabase.from("organizations").select("settings").eq("id", call.org_id).single();
    const settings = (orgRow?.settings as Record<string, unknown> | null);

    const { data: updatedCall } = await supabase
      .from("calls")
      .select("order_value, duration_seconds, customer_phone")
      .eq("id", body.callId)
      .single();

    const webhookPayload = {
      event: "call.completed",
      callId: body.callId,
      roomName: body.roomName,
      transcriptPreview: text.slice(0, 4000),
      sentiment: { label, score },
      orderValue: updatedCall?.order_value,
      duration: updatedCall?.duration_seconds,
      customerPhone: updatedCall?.customer_phone,
    };

    await dispatchCallCompletedWebhook(settings, webhookPayload);

    await syncToCrm(settings, {
      callId: body.callId,
      orgId: call.org_id,
      agentId: call.agent_id ?? undefined,
      customerPhone: updatedCall?.customer_phone ?? undefined,
      transcript: body.history,
      summary: summary,
      sentiment: label,
      orderValue: updatedCall?.order_value ?? 0,
      duration: updatedCall?.duration_seconds ?? 0,
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
