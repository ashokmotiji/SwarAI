import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureRoomWithMetadata } from "@/lib/livekit";
import { systemPromptWithFlow } from "@/lib/agent-prompt";
import { resolveVoiceSessionDailyLimit, tryConsumeVoiceSessionQuota } from "@/lib/org-quota";
import { normalizeE164 } from "@/lib/normalize-e164";

export type InboundAgentRow = {
  id: string;
  org_id: string;
  system_prompt: string;
  default_language: string;
  supported_languages: string[];
  voice_id: string;
  provider_stack: string;
  hinglish_friendly: boolean;
  telephony_config: unknown;
};

export async function findAgentByInboundE164(
  supabase: SupabaseClient,
  calledRaw: string,
): Promise<InboundAgentRow | null> {
  const e164 = normalizeE164(calledRaw);
  if (!e164) return null;

  const { data, error } = await supabase
    .from("agents")
    .select(
      "id, org_id, system_prompt, default_language, supported_languages, voice_id, provider_stack, hinglish_friendly, telephony_config",
    )
    .contains("telephony_config", { inboundE164: e164 })
    .limit(2);

  if (error || !data?.length) return null;
  if (data.length > 1) {
    console.error("pstn-inbound: multiple agents share inboundE164", e164);
    return null;
  }
  return data[0] as InboundAgentRow;
}

export type InboundProvisionResult =
  | { ok: true; roomName: string; callId: string }
  | { ok: false; reason: "quota" | "provision_failed" };

/**
 * Create LiveKit room + calls row for an inbound PSTN leg (one agent per DID via telephony_config.inboundE164).
 */
export async function provisionInboundPhoneSession(
  supabase: SupabaseClient,
  params: {
    agent: InboundAgentRow;
    fromE164: string;
    toE164: string;
    provider: "twilio" | "exotel";
    providerCallId: string;
  },
): Promise<InboundProvisionResult> {
  const { data: orgQuota } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", params.agent.org_id)
    .single();

  const dailyLimit = resolveVoiceSessionDailyLimit(orgQuota?.settings as Record<string, unknown> | null);
  const quotaOk = await tryConsumeVoiceSessionQuota(params.agent.org_id, dailyLimit);
  if (!quotaOk) return { ok: false, reason: "quota" };

  const callId = randomUUID();
  const roomName = `swarsales-in-${callId}`;

  const basePrompt =
    params.agent.system_prompt ||
    "You are SwarSales AI on a phone call. Greet briefly; confirm you are an AI assistant if asked.";
  const fullPrompt = await systemPromptWithFlow(supabase, params.agent.id, basePrompt);

  const metadata = {
    callId,
    agentId: params.agent.id,
    systemPrompt: fullPrompt,
    defaultLanguage: params.agent.default_language ?? "en",
    supportedLanguages: params.agent.supported_languages ?? ["en", "hi", "auto"],
    voiceId: params.agent.voice_id ?? "anushka",
    providerStack: params.agent.provider_stack ?? "sarvam",
    hinglishFriendly: params.agent.hinglish_friendly ?? true,
    telephonyConfig: params.agent.telephony_config ?? {},
  };

  await ensureRoomWithMetadata(roomName, metadata);

  const providerMeta =
    params.provider === "twilio"
      ? {
          direction: "inbound",
          provider: "twilio",
          from: normalizeE164(params.fromE164),
          to: normalizeE164(params.toE164),
          twilioCallSid: params.providerCallId,
        }
      : {
          direction: "inbound",
          provider: "exotel",
          from: normalizeE164(params.fromE164),
          to: normalizeE164(params.toE164),
          exotelCallSid: params.providerCallId,
        };

  const { error: insErr } = await supabase.from("calls").insert({
    id: callId,
    org_id: params.agent.org_id,
    agent_id: params.agent.id,
    channel: "phone",
    status: "active",
    livekit_room: roomName,
    provider_meta: providerMeta as never,
  });

  if (insErr) {
    console.error("pstn-inbound: calls insert failed", insErr);
    return { ok: false, reason: "provision_failed" };
  }

  return { ok: true, roomName, callId };
}
