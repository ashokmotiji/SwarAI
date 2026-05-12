"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nanoid } from "nanoid";
import type { FlowNodeKind } from "@swarsales/agent-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const KINDS: (FlowNodeKind | "objection" | "upsell")[] = ["start", "say", "listen", "branch", "tool", "handoff", "end", "objection", "upsell"];

type FlowNodeData = {
  kind: FlowNodeKind;
  label: string;
  configText: string;
};

function toGraph(nodes: Node<FlowNodeData>[], edges: Edge[]) {
  return {
    version: 1 as const,
    nodes: nodes.map((n) => {
      let config: Record<string, unknown> = {};
      try {
        config = n.data.configText.trim() ? (JSON.parse(n.data.configText) as Record<string, unknown>) : {};
      } catch {
        config = {};
      }
      return {
        id: n.id,
        kind: n.data.kind,
        label: n.data.label,
        config,
      };
    }),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      condition: typeof e.label === "string" ? e.label : undefined,
    })),
  };
}

type StoredEdge = { id?: string; source: string; target: string; condition?: string };

function fromGraph(graph: {
  nodes: { id: string; kind: FlowNodeKind; label: string; config?: Record<string, unknown> }[];
  edges: StoredEdge[];
}): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const nodes: Node<FlowNodeData>[] = graph.nodes.map((n, i) => ({
    id: n.id,
    type: "flowStep",
    position: { x: 80 + (i % 4) * 200, y: 60 + Math.floor(i / 4) * 120 },
    data: {
      kind: n.kind,
      label: n.label,
      configText: JSON.stringify(n.config ?? {}, null, 2),
    },
  }));
  const edges: Edge[] = (graph.edges ?? []).map((e, i) => ({
    id: e.id || `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.condition,
  }));
  return { nodes, edges };
}

function FlowStepNode({ data }: NodeProps<Node<FlowNodeData>>) {
  const isSpecial = data.kind === "objection" || data.kind === "upsell";
  return (
    <div className={cn(
      "min-w-[140px] rounded-lg border px-3 py-2 text-left shadow-sm",
      isSpecial ? "border-primary bg-primary/5" : "border-border bg-card"
    )}>
      <p className="text-[10px] font-semibold uppercase text-primary">{data.kind}</p>
      <p className="text-sm font-medium leading-tight">{data.label}</p>
    </div>
  );
}

const nodeTypes = { flowStep: FlowStepNode };

export function AgentFlowEditor({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [kind, setKind] = useState<FlowNodeKind>("say");
  const [label, setLabel] = useState("Step");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/flow`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Load failed");
        const g = data.graph as {
          nodes: { id: string; kind: FlowNodeKind; label: string; config?: Record<string, unknown> }[];
          edges: Edge[];
        };
        if (cancelled) return;
        if (g.nodes?.length) {
          const { nodes: n, edges: e } = fromGraph(g);
          setNodes(n);
          setEdges(e);
        } else {
          setNodes([
            {
              id: "start",
              type: "flowStep",
              position: { x: 120, y: 80 },
              data: { kind: "start", label: "Greeting", configText: "{}" },
            },
          ]);
          setEdges([]);
        }
      } catch (e) {
        if (!cancelled) setMsg(e instanceof Error ? e.message : "Error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, setEdges, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, id: nanoid() }, eds)),
    [setEdges],
  );

  function addNode() {
    const id = nanoid();
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: "flowStep",
        position: { x: 200 + ns.length * 24, y: 160 + ns.length * 18 },
        data: { kind, label, configText: kind === "say" ? '{"text":"Namaste, how can I help?"}' : "{}" },
      },
    ]);
  }

  async function save() {
    setMsg(null);
    const res = await fetch(`/api/agents/${agentId}/flow`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ graph: toGraph(nodes, edges) }),
    });
    const data = await res.json();
    if (!res.ok) setMsg(data.error || "Save failed");
    else setMsg(`Saved as version ${data.version}.`);
  }

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading flow…</p>;
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Flow · {agentName}</h1>
          <p className="text-sm text-muted-foreground">Visual graph compiles into the agent system prompt for LiveKit.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/dashboard/agents/${agentId}`}>Back to editor</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add step</CardTitle>
          <CardDescription>Nodes store JSON config (e.g. say → text, tool → toolName).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as FlowNodeKind)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-56" />
          </div>
          <Button type="button" onClick={addNode}>
            Add node
          </Button>
          <Button type="button" onClick={save}>
            Save flow
          </Button>
        </CardContent>
      </Card>

      {msg ? <p className="text-sm text-muted-foreground">{msg}</p> : null}

      <div className="h-[520px] w-full overflow-hidden rounded-xl border border-border bg-background">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
