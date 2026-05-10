import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { suggestPromptImprovement } from "@/lib/prompt-optimization";

const BodySchema = z.object({
  agentId: z.string().uuid(),
});

function historyToText(t: unknown): string {
  if (!t || typeof t !== "object") return "";
  const o = t as Record<string, unknown>;
  const items = (o.items ?? o.messages ?? []) as unknown[];
  if (!Array.isArray(items)) return JSON.stringify(t).slice(0, 4000);
  return items.map((x) => JSON.stringify(x)).join("\n").slice(0, 8000);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, system_prompt")
    .eq("id", body.agentId)
    .eq("org_id", orgId)
    .single();
  if (error || !agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const { data: recent } = await supabase
    .from("calls")
    .select("transcript")
    .eq("agent_id", body.agentId)
    .eq("status", "completed")
    .order("ended_at", { ascending: false })
    .limit(10);

  const samples = (recent ?? []).map((r) => historyToText(r.transcript));

  const suggestion = await suggestPromptImprovement({
    currentPrompt: agent.system_prompt,
    transcriptSamples: samples,
  });

  await supabase.from("prompt_suggestions").insert({
    agent_id: agent.id,
    call_sample_size: samples.length,
    suggestion,
  });

  return NextResponse.json({ ok: true, suggestion });
}
