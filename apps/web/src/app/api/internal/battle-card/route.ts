import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const BodySchema = z.object({
  callId: z.string().uuid(),
  competitor: z.string(),
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
  const { data: call } = await supabase.from("calls").select("org_id").eq("id", body.callId).single();

  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const { data: card } = await supabase
    .from("sales_battle_cards")
    .select("*")
    .eq("org_id", call.org_id)
    .ilike("competitor_name", `%${body.competitor}%`)
    .maybeSingle();

  return NextResponse.json({ card: card ?? null });
}
