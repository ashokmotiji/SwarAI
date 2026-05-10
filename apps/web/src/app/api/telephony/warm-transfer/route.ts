import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import twilio from "twilio";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitResponse } from "@/lib/rate-limit";

const BodySchema = z.object({
  callId: z.string().uuid(),
  targetE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
});

/**
 * Redirect an in-progress Twilio call to warm-transfer TwiML (human number).
 * Requires `provider_meta.twilioCallSid` on the `calls` row from your Twilio dial flow.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("warm-transfer", userId, 20, 60);
  if (limited) return limited;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();

  const { data: call, error } = await supabase
    .from("calls")
    .select("id, org_id, provider_meta")
    .eq("id", body.callId)
    .eq("org_id", orgId)
    .single();

  if (error || !call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

  const meta = (call.provider_meta as Record<string, unknown>) ?? {};
  const sid = typeof meta.twilioCallSid === "string" ? meta.twilioCallSid : null;
  if (!sid) {
    return NextResponse.json(
      { error: "No Twilio CallSid on this call — store twilioCallSid in provider_meta when using Twilio." },
      { status: 400 },
    );
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!accountSid || !authToken || !baseUrl) {
    return NextResponse.json({ error: "Twilio or app URL not configured" }, { status: 500 });
  }

  const twimlUrl = `${baseUrl}/api/webhooks/twilio/warm-transfer-twiml?to=${encodeURIComponent(body.targetE164)}`;
  const client = twilio(accountSid, authToken);
  await client.calls(sid).update({ url: twimlUrl, method: "POST" });

  await supabase
    .from("calls")
    .update({ status: "transferred", provider_meta: { ...meta, warmTransferTo: body.targetE164 } as never })
    .eq("id", body.callId);

  return NextResponse.json({ ok: true, twilioCallSid: sid });
}
