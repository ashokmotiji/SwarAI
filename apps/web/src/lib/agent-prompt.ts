import { compileAgentFlowGraph } from "@swarsales/agent-builder";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function systemPromptWithFlow(
  supabase: SupabaseClient,
  agentId: string | null | undefined,
  basePrompt: string,
): Promise<string> {
  if (!agentId) return basePrompt;
  const { data } = await supabase
    .from("agent_flows")
    .select("graph")
    .eq("agent_id", agentId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const block = data?.graph ? compileAgentFlowGraph(data.graph) : "";
  if (!block) return basePrompt;
  return `${basePrompt.trim()}\n\n---\nStructured flow (from builder):\n${block}`;
}
