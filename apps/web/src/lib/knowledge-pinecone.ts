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

/**
 * Optional Pinecone query when PINECONE_HOST + PINECONE_API_KEY set.
 * Expects vectors upserted with metadata: { content: string, agentId?: string } and namespace = agentId.
 */
export async function searchPineconeForAgent(agentId: string, query: string, topK = 8): Promise<string> {
  const host = process.env.PINECONE_HOST?.replace(/\/$/, "");
  const apiKey = process.env.PINECONE_API_KEY;
  if (!host || !apiKey) return "";

  const embedding = await embedQuery(query);
  if (!embedding?.length) return "";

  const res = await fetch(`${host}/query`, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      "Content-Type": "application/json",
      "X-Pinecone-Api-Version": "2024-10",
    },
    body: JSON.stringify({
      vector: embedding,
      topK,
      namespace: agentId,
      includeMetadata: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) return "";
  const data = (await res.json()) as { matches?: { metadata?: { content?: string; text?: string } }[] };
  const parts =
    data.matches?.map((m) => m.metadata?.content || m.metadata?.text).filter(Boolean) ?? [];
  return parts.join("\n---\n");
}

export async function searchKnowledgeHybrid(agentId: string, query: string, matchCount = 8): Promise<string> {
  const pine = await searchPineconeForAgent(agentId, query, matchCount);
  if (pine.trim()) return pine;

  const { searchKnowledgeForAgent } = await import("@/lib/knowledge-search");
  return searchKnowledgeForAgent(agentId, query, matchCount);
}
