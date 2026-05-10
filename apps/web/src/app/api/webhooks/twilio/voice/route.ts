import { NextResponse } from "next/server";
import twilio from "twilio";
import { createServiceClient } from "@/lib/supabase/service";
import { buildLiveKitSipDialUri } from "@/lib/livekit-sip-dial";
import { findAgentByInboundE164, provisionInboundPhoneSession } from "@/lib/pstn-inbound";
import { rateLimitResponse } from "@/lib/rate-limit";

function sipDialTarget(roomName: string): string {
  return buildLiveKitSipDialUri(roomName);
}

export async function POST(req: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const sipConfigured = Boolean(process.env.LIVEKIT_SIP_URI?.trim());
  if (!authToken) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const u = new URL(req.url);
  const fullUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? u.origin}/api/webhooks/twilio/voice${u.search}`;

  const valid = twilio.validateRequest(authToken, signature, fullUrl, Object.fromEntries(new URLSearchParams(body)));
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const params = new URLSearchParams(body);
  const roomFromQuery = u.searchParams.get("room") ?? params.get("room") ?? "";

  const vr = new twilio.twiml.VoiceResponse();

  if (!sipConfigured) {
    vr.say({ voice: "Polly.Aditi" }, "SIP bridge is not configured. Set LIVEKIT_SIP_URI for production telephony.");
    return new NextResponse(vr.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }

  let roomName = roomFromQuery;

  if (!roomName) {
    const to = params.get("To") ?? "";
    const from = params.get("From") ?? "";
    const callSid = params.get("CallSid") ?? "";

    const limited = await rateLimitResponse("twilio-inbound-voice", from || "unknown", 120, 60);
    if (limited) {
      const busy = new twilio.twiml.VoiceResponse();
      busy.say({ voice: "Polly.Aditi" }, "Too many calls from this number. Please try again later.");
      busy.hangup();
      return new NextResponse(busy.toString(), { headers: { "Content-Type": "text/xml" } });
    }

    const supabase = createServiceClient();
    const agent = await findAgentByInboundE164(supabase, to);
    if (!agent) {
      vr.say({ voice: "Polly.Aditi" }, "This phone number is not linked to an agent yet.");
      vr.hangup();
      return new NextResponse(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const prov = await provisionInboundPhoneSession(supabase, {
      agent,
      fromE164: from,
      toE164: to,
      provider: "twilio",
      providerCallId: callSid,
    });

    if (!prov.ok) {
      const msg =
        prov.reason === "quota"
          ? "This workspace has reached its daily voice limit. Please try again later."
          : "We could not start this call. Please try again later.";
      if (prov.reason === "provision_failed") {
        console.error("twilio voice inbound: provision failed");
      }
      vr.say({ voice: "Polly.Aditi" }, msg);
      vr.hangup();
      return new NextResponse(vr.toString(), {
        headers: { "Content-Type": "text/xml" },
      });
    }
    roomName = prov.roomName;
  }

  vr.say({ voice: "Polly.Aditi" }, `Connecting you to SwarAI. Please hold.`);
  let sipTarget: string;
  try {
    sipTarget = sipDialTarget(roomName);
  } catch (e) {
    console.error("twilio voice: SIP dial URI", e);
    vr.say({ voice: "Polly.Aditi" }, "LiveKit SIP is not fully configured.");
    return new NextResponse(vr.toString(), {
      headers: { "Content-Type": "text/xml" },
    });
  }
  const dial = vr.dial({ answerOnBridge: true });
  const sipAttrs: Record<string, string> = {};
  if (process.env.LIVEKIT_SIP_USERNAME) sipAttrs.username = process.env.LIVEKIT_SIP_USERNAME;
  if (process.env.LIVEKIT_SIP_PASSWORD) sipAttrs.password = process.env.LIVEKIT_SIP_PASSWORD;
  dial.sip(sipAttrs, sipTarget);

  return new NextResponse(vr.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
