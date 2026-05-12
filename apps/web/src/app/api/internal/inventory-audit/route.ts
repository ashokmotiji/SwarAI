import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const BodySchema = z.object({
  callId: z.string().uuid(),
  product: z.string(),
  stock: z.number().int(),
  notes: z.string(),
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

  const supabase = createServiceClient();
  const { data: call } = await supabase.from("calls").select("provider_meta").eq("id", body.callId).single();
  const meta = (call?.provider_meta as Record<string, unknown>) || {};
  const audits = meta.inventory_audits || [];
  audits.push({
    product: body.product,
    stock: body.stock,
    notes: body.notes,
    audited_at: new Date().toISOString()
  });

  await supabase.from("calls").update({
    provider_meta: { ...meta, inventory_audits: audits } as unknown
  }).eq("id", body.callId);

  return NextResponse.json({ ok: true });
}
