import { NextResponse } from "next/server";
import { z } from "zod";
import { insertCalendarEvent } from "@/lib/google-calendar-service";

const BodySchema = z.object({
  summary: z.string().min(1).max(500),
  description: z.string().max(4000).optional(),
  startIso: z.string().min(10),
  endIso: z.string().min(10),
});

export async function POST(req: Request) {
  const secret = process.env.SWARAI_INTERNAL_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-swarai-internal") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ev = await insertCalendarEvent({
    summary: body.summary,
    description: body.description,
    startIso: body.startIso,
    endIso: body.endIso,
  });

  if (!ev) {
    return NextResponse.json({ error: "Calendar not configured" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, ...ev });
}
