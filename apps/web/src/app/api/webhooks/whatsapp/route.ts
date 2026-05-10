import { after } from "next/server";
import { NextResponse } from "next/server";
import { verifyMetaWhatsAppSignature } from "@/lib/webhook-outbound";
import { createServiceClient } from "@/lib/supabase/service";
import { extractInboundMessages } from "@/lib/whatsapp-cloud";
import { handleWhatsAppInbound } from "@/lib/whatsapp-ai-reply";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const mode = u.searchParams.get("hub.mode");
  const token = u.searchParams.get("hub.verify_token");
  const challenge = u.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const rawBody = await req.text();

  if (secret) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyMetaWhatsAppSignature(rawBody, sig, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error: logErr } = await supabase.from("whatsapp_inbound").insert({ raw: payload as never });
  if (logErr) {
    /* e.g. migration not applied yet — still 200 for Meta */
  }

  after(() => {
    void (async () => {
      for (const m of extractInboundMessages(payload)) {
        await handleWhatsAppInbound(m);
      }
    })();
  });

  return NextResponse.json({ received: true });
}
