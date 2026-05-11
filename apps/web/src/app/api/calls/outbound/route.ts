import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import twilio from "twilio";
import { randomUUID } from "crypto";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureRoomWithMetadata, liveKitWsUrl, getLiveKitConfig, mintParticipantToken } from "@/lib/livekit";
import { systemPromptWithFlow } from "@/lib/agent-prompt";
import { rateLimitResponse } from "@/lib/rate-limit";
import { resolveVoiceSessionDailyLimit, tryConsumeVoiceSessionQuota } from "@/lib/org-quota";

const BodySchema = z.object({
  to: z.string().min(8),
  agentId: z.string().uuid().optional(),
  provider: z.enum(["twilio", "exotel"]).default("twilio"),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("calls-outbound", userId, 30, 60);
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

  const { data: orgQuota } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  const dailyLimit = resolveVoiceSessionDailyLimit(orgQuota?.settings as Record<string, unknown> | null);
  const quotaOk = await tryConsumeVoiceSessionQuota(orgId, dailyLimit);
  if (!quotaOk) {
    return NextResponse.json({ error: "Daily voice session limit for this workspace." }, { status: 429 });
  }

  const callId = randomUUID();
  const roomName = `swarsales-out-${callId}`;

  let agent: {
    id: string;
    system_prompt: string;
    default_language: string;
    supported_languages: string[];
    voice_id: string;
    provider_stack: string;
    hinglish_friendly: boolean;
    telephony_config: unknown;
  } | null = null;

  if (body.agentId) {
    const { data } = await supabase
      .from("agents")
      .select(
        "id, system_prompt, default_language, supported_languages, voice_id, provider_stack, hinglish_friendly, telephony_config",
      )
      .eq("id", body.agentId)
      .eq("org_id", orgId)
      .maybeSingle();
    agent = data;
  }

  const basePrompt =
    agent?.system_prompt ??
    "You are SwarSales AI on a phone call. Greet briefly; confirm you are an AI assistant if asked.";
  const fullPrompt = await systemPromptWithFlow(supabase, agent?.id ?? body.agentId, basePrompt);

  const metadata = {
    callId,
    agentId: body.agentId,
    systemPrompt: fullPrompt,
    defaultLanguage: agent?.default_language ?? "en",
    supportedLanguages: agent?.supported_languages ?? ["en", "hi", "auto"],
    voiceId: agent?.voice_id ?? "anushka",
    providerStack: agent?.provider_stack ?? "sarvam",
    hinglishFriendly: agent?.hinglish_friendly ?? true,
    telephonyConfig: agent?.telephony_config ?? {},
  };

  await ensureRoomWithMetadata(roomName, metadata);

  await supabase.from("calls").insert({
    id: callId,
    org_id: orgId,
    agent_id: body.agentId ?? null,
    customer_phone: body.to,
    channel: "phone",
    status: "active",
    livekit_room: roomName,
    provider_meta: { provider: body.provider, to: body.to },
  });

  const sipUri = process.env.LIVEKIT_SIP_URI;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM_NUMBER;

  if (body.provider === "twilio" && twilioSid && twilioToken && twilioFrom && sipUri) {
    const client = twilio(twilioSid, twilioToken);
    const twCall = await client.calls.create({
      to: body.to,
      from: twilioFrom,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio/voice?room=${encodeURIComponent(roomName)}&outbound=1`,
    });
    await supabase
      .from("calls")
      .update({
        provider_meta: {
          provider: body.provider,
          to: body.to,
          twilioCallSid: twCall.sid,
        } as never,
      })
      .eq("id", callId);
    return NextResponse.json({ ok: true, callId, roomName, mode: "twilio-dial", twilioCallSid: twCall.sid });
  }

  if (body.provider === "exotel" && process.env.EXOTEL_API_KEY && process.env.EXOTEL_SID && process.env.EXOTEL_TOKEN) {
    const exoUrl = `https://api.exotel.com/v1/Accounts/${process.env.EXOTEL_SID}/Calls/connect.json`;
    const form = new URLSearchParams({
      From: process.env.EXOTEL_CALLER_ID ?? "",
      To: body.to,
      CallerId: process.env.EXOTEL_CALLER_ID ?? "",
      Url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/exotel/voice?room=${encodeURIComponent(roomName)}`,
    });
    await fetch(exoUrl, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${process.env.EXOTEL_API_KEY}:${process.env.EXOTEL_TOKEN}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    return NextResponse.json({ ok: true, callId, roomName, mode: "exotel" });
  }

  let livekitWsUrl: string | null = null;
  let agentToken: string | null = null;
  try {
    livekitWsUrl = liveKitWsUrl(getLiveKitConfig().host);
    agentToken = await mintParticipantToken(roomName, `pstn-bridge-${callId}`, "PSTN bridge");
  } catch {
    /* LiveKit not configured */
  }

  return NextResponse.json({
    ok: true,
    callId,
    roomName,
    livekitWsUrl,
    agentToken,
    mode: "manual",
    message:
      "Telephony credentials or LIVEKIT_SIP_URI not configured — returned room + token for manual SIP bridging when LiveKit is available.",
  });
}
