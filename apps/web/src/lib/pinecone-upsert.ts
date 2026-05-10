/** Pinecone data plane upsert (serverless index host + API key). Namespace = agent id. */

const API_VERSION = "2024-10";

export type PineconeUpsertVector = { id: string; values: number[]; content: string };

export async function upsertVectorsForAgent(agentId: string, vectors: PineconeUpsertVector[]): Promise<{
  ok: boolean;
  upserted: number;
  error?: string;
}> {
  const host = process.env.PINECONE_HOST?.replace(/\/$/, "");
  const apiKey = process.env.PINECONE_API_KEY;
  if (!host || !apiKey || vectors.length === 0) {
    return { ok: true, upserted: 0 };
  }

  const batchSize = 40;
  let upserted = 0;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    const res = await fetch(`${host}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
        "X-Pinecone-Api-Version": API_VERSION,
      },
      body: JSON.stringify({
        vectors: batch.map((v) => ({
          id: v.id,
          values: v.values,
          metadata: {
            content: v.content.slice(0, 8000),
            agentId,
          },
        })),
        namespace: agentId,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, upserted, error: t.slice(0, 500) || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { upsertedCount?: number };
    upserted += data.upsertedCount ?? batch.length;
  }
  return { ok: true, upserted };
}
