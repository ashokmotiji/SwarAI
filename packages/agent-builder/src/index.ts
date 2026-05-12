import { z } from "zod";

export const FlowNodeKindSchema = z.enum([
  "start",
  "say",
  "listen",
  "branch",
  "tool",
  "handoff",
  "end",
  "objection",
  "upsell",
]);

export type FlowNodeKind = z.infer<typeof FlowNodeKindSchema>;

export const FlowNodeSchema = z.object({
  id: z.string(),
  kind: FlowNodeKindSchema,
  label: z.string(),
  /** Arbitrary config per node kind (prompt fragment, tool name, etc.) */
  config: z.record(z.unknown()).default({}),
});

export type FlowNode = z.infer<typeof FlowNodeSchema>;

export const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  condition: z.string().optional(),
});

export type FlowEdge = z.infer<typeof FlowEdgeSchema>;

export const AgentFlowGraphSchema = z.object({
  version: z.number().int().positive().default(1),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
});

export type AgentFlowGraph = z.infer<typeof AgentFlowGraphSchema>;

export function validateAgentFlow(graph: unknown): AgentFlowGraph {
  return AgentFlowGraphSchema.parse(graph);
}

export function graphToSystemPromptStub(graph: AgentFlowGraph): string {
  return compileAgentFlowGraph(graph);
}

/** Turn a saved flow graph into prompt instructions for the LLM. */
export function compileAgentFlowGraph(graph: unknown): string {
  const parsed = AgentFlowGraphSchema.safeParse(graph);
  if (!parsed.success) return "";

  const g = parsed.data;
  const lines: string[] = [
    "Follow this conversation flow unless the user clearly goes off-script; then help naturally and return to the flow when possible.",
  ];

  for (const n of g.nodes) {
    const cfg = n.config as Record<string, unknown>;
    switch (n.kind) {
      case "start":
        lines.push(`- Start: ${n.label}`);
        break;
      case "say":
        lines.push(
          `- Say (${n.label}): ${typeof cfg.text === "string" ? cfg.text : "[use label as intent]"}`,
        );
        break;
      case "listen":
        lines.push(`- Listen for: ${n.label}${cfg.hints ? ` — hints: ${String(cfg.hints)}` : ""}`);
        break;
      case "branch":
        lines.push(`- Branch (${n.label}): ${typeof cfg.condition === "string" ? cfg.condition : "evaluate user intent"}`);
        break;
      case "tool":
        lines.push(
          `- Run tool "${typeof cfg.toolName === "string" ? cfg.toolName : "unknown"}" (${n.label})`,
        );
        break;
      case "handoff":
        lines.push(`- Hand off to human: ${n.label}${cfg.reason ? ` — ${String(cfg.reason)}` : ""}`);
        break;
      case "end":
        lines.push(`- End: ${n.label}`);
        break;
      case "objection":
        lines.push(`- Objection Handling (${n.label}): ${typeof cfg.strategy === "string" ? cfg.strategy : "address customer concern"}`);
        break;
      case "upsell":
        lines.push(`- Upsell Opportunity (${n.label}): ${typeof cfg.offer === "string" ? cfg.text : "suggest related product"}`);
        break;
      default:
        lines.push(`- [${n.kind}] ${n.label}`);
    }
  }

  if (g.edges.length) {
    lines.push("Transitions (edges):");
    for (const e of g.edges) {
      lines.push(`  ${e.source} → ${e.target}${e.condition ? ` if ${e.condition}` : ""}`);
    }
  }

  return lines.join("\n");
}
