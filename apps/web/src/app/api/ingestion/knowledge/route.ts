import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitResponse } from "@/lib/rate-limit";
import { upsertVectorsForAgent } from "@/lib/pinecone-upsert";

const BodySchema = z.object({
  agentId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  text: z.string().min(1).max(500_000),
});

function chunkText(text: string, max = 1200): string[] {
  const paras = text.split(/\n\n+/);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + p).length > max) {
      if (cur) out.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [text.slice(0, max)];
}

async function embedBatch(chunks: string[]): Promise<(number[] | null)[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return chunks.map(() => null);
  const out: (number[] | null)[] = [];
  for (const c of chunks) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: c.slice(0, 8000) }),
    });
    if (!res.ok) {
      out.push(null);
      continue;
    }
    const data = (await res.json()) as { data?: { embedding: number[] }[] };
    out.push(data.data?.[0]?.embedding ?? null);
  }
  return out;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("ingestion-knowledge", userId, 20, 60);
  if (limited) return limited;

  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.agentId) {
    const supabase = createServiceClient();
    const { data: ag } = await supabase.from("agents").select("id").eq("id", body.agentId).eq("org_id", orgId).single();
    if (!ag) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const supabase = createServiceClient();
  const { data: source, error: sErr } = await supabase
    .from("knowledge_sources")
    .insert({
      org_id: orgId,
      agent_id: body.agentId ?? null,
      kind: "text",
      title: body.title,
      source_uri: null,
      status: "pending",
    })
    .select("id")
    .single();

  if (sErr || !source) {
    return NextResponse.json({ error: sErr?.message ?? "Failed to create source" }, { status: 500 });
  }

  const { data: job, error: jErr } = await supabase
    .from("ingestion_jobs")
    .insert({ source_id: source.id, state: "running" })
    .select("id")
    .single();

  if (jErr || !job) {
    return NextResponse.json({ error: jErr?.message ?? "Job error" }, { status: 500 });
  }

  const chunks = chunkText(body.text);
  const embeddings = await embedBatch(chunks);

  const rows = chunks.map((content, i) => ({
    source_id: source.id,
    content,
    chunk_index: i,
    embedding: embeddings[i] as never,
  }));

  const { data: insertedRows, error: cErr } = await supabase
    .from("document_chunks")
    .insert(rows)
    .select("id, content, chunk_index");

  if (cErr || !insertedRows?.length) {
    await supabase.from("ingestion_jobs").update({ state: "error", error: cErr?.message ?? "insert" }).eq("id", job.id);
    await supabase.from("knowledge_sources").update({ status: "failed" }).eq("id", source.id);
    return NextResponse.json({ error: cErr?.message ?? "Chunk insert failed" }, { status: 500 });
  }

  let pineconeUpserted = 0;
  let pineconeError: string | undefined;
  if (body.agentId) {
    const vectors = insertedRows
      .map((row) => {
        const emb = embeddings[row.chunk_index];
        if (!emb?.length) return null;
        return { id: row.id, values: emb, content: row.content };
      })
      .filter((v): v is { id: string; values: number[]; content: string } => v != null);
    const pine = await upsertVectorsForAgent(body.agentId, vectors);
    pineconeUpserted = pine.upserted;
    if (!pine.ok && pine.error) pineconeError = pine.error;
  }

  await supabase.from("ingestion_jobs").update({ state: "done" }).eq("id", job.id);
  await supabase.from("knowledge_sources").update({ status: "ready" }).eq("id", source.id);

  return NextResponse.json({
    sourceId: source.id,
    chunks: chunks.length,
    jobId: job.id,
    pineconeUpserted,
    ...(pineconeError ? { pineconeWarning: pineconeError } : {}),
  });
}
