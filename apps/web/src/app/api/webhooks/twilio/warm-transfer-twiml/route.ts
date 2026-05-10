import { NextResponse } from "next/server";

/** Twilio fetches this URL to bridge the caller to a human agent. */
export async function POST(req: Request) {
  return twiml(req);
}

export async function GET(req: Request) {
  return twiml(req);
}

function twiml(req: Request) {
  const u = new URL(req.url);
  const to = u.searchParams.get("to")?.replace(/[^\d+]/g, "") ?? "";
  if (!to || to.length < 8) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Transfer target missing.</Say></Response>`;
    return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
  }

  const from = process.env.TWILIO_FROM_NUMBER ?? "";
  const dialAttrs = from ? ` timeout="45" callerId="${escapeXml(from)}"` : ` timeout="45"`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Connecting you to a specialist. Please hold.</Say>
  <Dial${dialAttrs}>${escapeXml(to)}</Dial>
</Response>`;
  return new NextResponse(xml, { headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}
