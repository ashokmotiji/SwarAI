import { NextResponse } from "next/server";
import { z } from "zod";
import { searchKnowledgeHybrid } from "@/lib/knowledge-pinecone";

const BodySchema = z.object({
  agentId: z.string().uuid(),
  query: z.string().min(1).max(2000),
  matchCount: z.number().int().min(1).max(24).optional(),
});

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

  const text = await searchKnowledgeHybrid(body.agentId, body.query, body.matchCount ?? 8);
  return NextResponse.json({ text, found: text.length > 0 });
}
