import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";

const BodySchema = z.object({
  callId: z.string().uuid(),
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

  const { data: callData, error: callError } = await supabase
    .from("calls")
    .select("org_id, customer_phone")
    .eq("id", body.callId)
    .single();

  if (callError || !callData?.customer_phone) {
    return NextResponse.json({ context: {} });
  }

  const { data, error } = await supabase
    .from("customer_contexts")
    .select("context_data")
    .eq("org_id", callData.org_id)
    .eq("customer_phone", callData.customer_phone)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ context: data?.context_data ?? {} });
}
