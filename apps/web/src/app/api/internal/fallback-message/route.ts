import { NextResponse } from "next/server";
import { z } from "zod";
import { sendWhatsAppText } from "@/lib/whatsapp-cloud";
import { createServiceClient } from "@/lib/supabase/service";

const BodySchema = z.object({
  callId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  channel: z.enum(["whatsapp", "sms"]),
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
  const { data: call } = await supabase
    .from("calls")
    .select("org_id, customer_phone")
    .eq("id", body.callId)
    .single();

  if (!call || !call.customer_phone) {
    return NextResponse.json({ error: "Customer phone not found" }, { status: 404 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", call.org_id)
    .single();

  const settings = (org?.settings as Record<string, unknown>) || {};

  if (body.channel === "whatsapp") {
    const waId = (settings.whatsappPhoneNumberId as string) || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const waToken = (settings.whatsappAccessToken as string) || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!waId || !waToken) {
      return NextResponse.json({ error: "WhatsApp not configured for this org" }, { status: 400 });
    }

    const ok = await sendWhatsAppText(call.customer_phone, body.message, waId, waToken);
    return NextResponse.json({ ok });
  } else {
    // SMS Fallback logic (e.g. via Twilio)
    // For now we'll just log it or use a generic Twilio helper if available
    console.log(`Sending SMS to ${call.customer_phone}: ${body.message}`);
    // implementation for Twilio SMS could go here
    return NextResponse.json({ ok: true, message: "SMS logged (Twilio bridge needed)" });
  }
}
