import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildLiveKitSipDialUri } from "@/lib/livekit-sip-dial";
import { findAgentByInboundE164, provisionInboundPhoneSession } from "@/lib/pstn-inbound";
import { rateLimitResponse } from "@/lib/rate-limit";

/** Exotel applet / passthru URL — returns TwiML-compatible XML (Exotel accepts similar verbs). */
export async function POST(req: Request) {
  const sipConfigured = Boolean(process.env.LIVEKIT_SIP_URI?.trim());
  const url = new URL(req.url);
  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  const roomFromQuery = url.searchParams.get("room") ?? params.get("room") ?? "";

  const to = params.get("CallTo") ?? params.get("To") ?? "";
  const from = params.get("CallFrom") ?? params.get("From") ?? "";
  const callSid = params.get("CallSid") ?? params.get("Sid") ?? "";

  let roomName = roomFromQuery;

  if (!sipConfigured) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>SIP bridge not configured.</Say></Response>`;
    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
  }

  if (!roomName && to) {
    const limited = await rateLimitResponse("exotel-inbound-voice", from || "unknown", 120, 60);
    if (limited) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Too many calls. Try again later.</Say><Hangup/></Response>`;
      return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
    }

    const supabase = createServiceClient();
    const agent = await findAgentByInboundE164(supabase, to);
    if (!agent) {
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>This phone number is not linked to an agent yet.</Say><Hangup/></Response>`;
      return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
    }

    const prov = await provisionInboundPhoneSession(supabase, {
      agent,
      fromE164: from,
      toE164: to,
      provider: "exotel",
      providerCallId: callSid || `exo-${Date.now()}`,
    });

    if (!prov.ok) {
      const msg =
        prov.reason === "quota"
          ? "Daily voice limit reached. Please try again later."
          : "We could not start this call.";
      const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(msg)}</Say><Hangup/></Response>`;
      return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
    }
    roomName = prov.roomName;
  }

  if (!roomName) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Missing room or called number.</Say></Response>`;
    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
  }

  let sipUri: string;
  try {
    sipUri = buildLiveKitSipDialUri(roomName);
  } catch {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>LiveKit SIP is not configured.</Say></Response>`;
    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
  }

  const say = `<Say>Connecting to SwarAI. Please hold.</Say><Dial><Sip username="${escapeXml(
    process.env.LIVEKIT_SIP_USERNAME ?? "",
  )}" password="${escapeXml(process.env.LIVEKIT_SIP_PASSWORD ?? "")}">${escapeXml(sipUri)}</Sip></Dial>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response>${say}</Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
