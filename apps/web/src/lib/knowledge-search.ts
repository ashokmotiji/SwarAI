import { createServiceClient } from "@/lib/supabase/service";

async function embedQuery(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: { embedding: number[] }[] };
  return data.data?.[0]?.embedding ?? null;
}

/** Fallback when embeddings unavailable: recent chunks for org+agent scope. */
async function keywordFallback(agentId: string, query: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data: agent } = await supabase.from("agents").select("org_id").eq("id", agentId).single();
  if (!agent?.org_id) return [];

  const { data: sources } = await supabase
    .from("knowledge_sources")
    .select("id")
    .eq("org_id", agent.org_id)
    .or(`agent_id.is.null,agent_id.eq.${agentId}`);

  const ids = (sources ?? []).map((s) => s.id);
  if (!ids.length) return [];

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);

  let q = supabase
    .from("document_chunks")
    .select("content")
    .in("source_id", ids)
    .order("created_at", { ascending: false })
    .limit(24);

  if (words.length) {
    const orFilter = words
      .map((w) => `content.ilike.%${w.replace(/%/g, "").replace(/,/g, "")}%`)
      .join(",");
    q = q.or(orFilter);
  }

  const { data: chunks } = await q;
  return (chunks ?? []).map((c) => c.content as string);
}

export async function searchKnowledgeForAgent(agentId: string, query: string, matchCount = 8): Promise<string> {
  const supabase = createServiceClient();
  const embedding = await embedQuery(query);

  if (embedding?.length) {
    const { data, error } = await supabase.rpc("match_document_chunks_for_agent", {
      p_agent_id: agentId,
      p_query_embedding: embedding,
      p_match_count: matchCount,
    });
    if (!error && data?.length) {
      return (data as { content: string }[]).map((r) => r.content).join("\n---\n");
    }
  }

  const fb = await keywordFallback(agentId, query);
  if (fb.length) return fb.slice(0, matchCount).join("\n---\n");
  return "";
}
