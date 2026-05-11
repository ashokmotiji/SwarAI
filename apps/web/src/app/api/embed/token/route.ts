import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureRoomWithMetadata, getLiveKitConfig, liveKitWsUrl, mintParticipantToken } from "@/lib/livekit";
import { systemPromptWithFlow } from "@/lib/agent-prompt";
import { rateLimitResponse } from "@/lib/rate-limit";
import { resolveVoiceSessionDailyLimit, tryConsumeVoiceSessionQuota } from "@/lib/org-quota";

const BodySchema = z.object({
  agentId: z.string().uuid(),
  displayName: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "embed";
  const limited = await rateLimitResponse("embed-token", ip, 120, 60);
  if (limited) return limited;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: agent, error } = await supabase
    .from("agents")
    .select(
      "id, org_id, system_prompt, default_language, supported_languages, voice_id, provider_stack, hinglish_friendly, embed_allowed_origins, status, telephony_config",
    )
    .eq("id", body.agentId)
    .eq("status", "active")
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const allowed: string[] = agent.embed_allowed_origins ?? [];
  const originHost = safeHost(origin);
  if (process.env.NODE_ENV === "production" && allowed.length === 0) {
    return NextResponse.json(
      { error: "Configure embed_allowed_origins on the agent before using embed in production." },
      { status: 403 },
    );
  }
  if (allowed.length > 0) {
    const ok = allowed.some((a) => a === originHost || origin.startsWith(a));
    if (!ok) {
      return NextResponse.json({ error: "Origin not allowed for this embed" }, { status: 403 });
    }
  }

  const { data: orgQuota } = await supabase.from("organizations").select("settings").eq("id", agent.org_id).single();
  const dailyLimit = resolveVoiceSessionDailyLimit(orgQuota?.settings as Record<string, unknown> | null);
  const quotaOk = await tryConsumeVoiceSessionQuota(agent.org_id, dailyLimit);
  if (!quotaOk) {
    return NextResponse.json({ error: "Daily voice session limit for this workspace." }, { status: 429 });
  }

  const callId = randomUUID();
  const roomName = `swarsales-embed-${callId}`;
  const fullPrompt = await systemPromptWithFlow(supabase, agent.id, agent.system_prompt);
  const metadata = {
    callId,
    agentId: agent.id,
    systemPrompt: fullPrompt,
    defaultLanguage: agent.default_language,
    supportedLanguages: agent.supported_languages,
    voiceId: agent.voice_id,
    providerStack: agent.provider_stack,
    hinglishFriendly: agent.hinglish_friendly,
    telephonyConfig: agent.telephony_config ?? {},
  };

  await ensureRoomWithMetadata(roomName, metadata);

  await supabase.from("calls").insert({
    id: callId,
    org_id: agent.org_id,
    agent_id: agent.id,
    channel: "embed",
    status: "active",
    livekit_room: roomName,
    provider_meta: { origin: origin || null },
  });

  const identity = `embed-${callId}`;
  const token = await mintParticipantToken(roomName, identity, body.displayName ?? "Web visitor");

  let url: string;
  try {
    url = liveKitWsUrl(getLiveKitConfig().host);
  } catch {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  return NextResponse.json({ token, url, roomName, callId });
}

function safeHost(o: string) {
  try {
    return new URL(o).origin;
  } catch {
    return "";
  }
}
