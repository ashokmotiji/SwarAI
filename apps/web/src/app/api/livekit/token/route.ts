import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePersonalOrg } from "@/lib/org";
import { ensureRoomWithMetadata, getLiveKitConfig, liveKitWsUrl, mintParticipantToken } from "@/lib/livekit";
import { createServiceClient } from "@/lib/supabase/service";
import { systemPromptWithFlow } from "@/lib/agent-prompt";
import { rateLimitResponse } from "@/lib/rate-limit";
import { resolveVoiceSessionDailyLimit, tryConsumeVoiceSessionQuota } from "@/lib/org-quota";
import { randomUUID } from "crypto";

const BodySchema = z.object({
  agentId: z.string().uuid().optional(),
  displayName: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimitResponse("livekit-token", userId, 40, 60);
  if (limited) return limited;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const orgId = await ensurePersonalOrg(userId, email);

  const supabase = createServiceClient();

  const { data: orgQuota } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  const dailyLimit = resolveVoiceSessionDailyLimit(orgQuota?.settings as Record<string, unknown> | null);
  const quotaOk = await tryConsumeVoiceSessionQuota(orgId, dailyLimit);
  if (!quotaOk) {
    return NextResponse.json(
      { error: "Daily voice session limit reached for this workspace. Raise the cap in Settings or upgrade plan." },
      { status: 429 },
    );
  }

  let agent:
    | {
        id: string;
        system_prompt: string;
        default_language: string;
        supported_languages: string[];
        voice_id: string;
        provider_stack: string;
        hinglish_friendly: boolean;
        telephony_config: unknown;
      }
    | undefined;

  if (body.agentId) {
    const { data, error } = await supabase
      .from("agents")
      .select(
        "id, system_prompt, default_language, supported_languages, voice_id, provider_stack, hinglish_friendly, telephony_config",
      )
      .eq("id", body.agentId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    agent = data;
  }

  const callId = randomUUID();
  const roomName = `swarai-${callId}`;

  const basePrompt =
    agent?.system_prompt ??
    "You are SwarAI, a helpful multilingual voice assistant for Indian users. Be concise and respectful.";
  const fullPrompt = await systemPromptWithFlow(supabase, agent?.id, basePrompt);

  const metadata = {
    callId,
    agentId: agent?.id,
    systemPrompt: fullPrompt,
    defaultLanguage: agent?.default_language ?? "en",
    supportedLanguages: agent?.supported_languages ?? ["en", "hi", "auto"],
    voiceId: agent?.voice_id ?? "anushka",
    providerStack: agent?.provider_stack ?? "sarvam",
    hinglishFriendly: agent?.hinglish_friendly ?? true,
    telephonyConfig: agent?.telephony_config ?? {},
  };

  await ensureRoomWithMetadata(roomName, metadata);

  const { data: callRow, error: callErr } = await supabase
    .from("calls")
    .insert({
      id: callId,
      org_id: orgId,
      agent_id: agent?.id ?? null,
      channel: "web",
      status: "active",
      livekit_room: roomName,
      provider_meta: { source: "simulator" },
    })
    .select("id")
    .single();

  if (callErr || !callRow) {
    return NextResponse.json({ error: callErr?.message ?? "Failed to create call" }, { status: 500 });
  }

  const identity = `user-${userId}`;
  const token = await mintParticipantToken(roomName, identity, body.displayName ?? user?.firstName ?? "User");

  let url: string;
  try {
    url = liveKitWsUrl(getLiveKitConfig().host);
  } catch {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  return NextResponse.json({
    token,
    url,
    roomName,
    identity,
    callId,
  });
}
