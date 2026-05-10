import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentFlowGraphSchema } from "@swarai/agent-builder";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitResponse } from "@/lib/rate-limit";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: agentId } = await ctx.params;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();

  const { data: agent, error: aErr } = await supabase.from("agents").select("id").eq("id", agentId).eq("org_id", orgId).single();
  if (aErr || !agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: flow } = await supabase
    .from("agent_flows")
    .select("version, graph")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    version: flow?.version ?? 0,
    graph: flow?.graph ?? { version: 1, nodes: [], edges: [] },
  });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("agent-flow", userId, 30, 60);
  if (limited) return limited;

  const { id: agentId } = await ctx.params;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();

  const { data: agent, error: aErr } = await supabase.from("agents").select("id").eq("id", agentId).eq("org_id", orgId).single();
  if (aErr || !agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const BodySchema = z.object({ graph: AgentFlowGraphSchema });
  let graph: z.infer<typeof AgentFlowGraphSchema>;
  try {
    graph = BodySchema.parse(await req.json()).graph;
  } catch {
    return NextResponse.json({ error: "Invalid graph" }, { status: 400 });
  }

  const { data: latest } = await supabase
    .from("agent_flows")
    .select("version")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;
  const { error: insErr } = await supabase.from("agent_flows").insert({
    agent_id: agentId,
    version: nextVersion,
    graph: graph as never,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, version: nextVersion });
}
