import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppText } from "@/lib/whatsapp-cloud";

const BodySchema = z.object({
  callId: z.string().uuid(),
  items: z.string(), // JSON string or text
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
  const { data: call } = await supabase.from("calls").select("org_id, customer_phone").eq("id", body.callId).single();

  if (!call || !call.customer_phone) {
    return NextResponse.json({ error: "No customer phone" }, { status: 404 });
  }

  const { data: org } = await supabase.from("organizations").select("name, settings").eq("id", call.org_id).single();
  const settings = (org?.settings as Record<string, unknown>) || {};

  const quoteText = `*Sales Quote from ${org?.name || "SwarSales AI"}*\n\nItems discussed:\n${body.items}\n\nTo confirm this order, please reply with 'YES'.`;

  const waId = (settings.whatsappPhoneNumberId as string) || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const waToken = (settings.whatsappAccessToken as string) || process.env.WHATSAPP_ACCESS_TOKEN;

  if (waId && waToken) {
    await sendWhatsAppText(call.customer_phone, quoteText, waId, waToken);
    return NextResponse.json({ ok: true, sent: "whatsapp" });
  }

  return NextResponse.json({ ok: false, error: "WhatsApp not configured" }, { status: 500 });
}
