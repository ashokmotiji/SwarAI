import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitResponse } from "@/lib/rate-limit";
import { createElevenLabsVoiceFromSample } from "@/lib/elevenlabs-voice";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/webm", "audio/ogg"]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("voice-sample", userId, 20, 3600);
  if (limited) return limited;

  const { id: agentId } = await ctx.params;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();

  const { data: agent, error: aErr } = await supabase
    .from("agents")
    .select("id, telephony_config")
    .eq("id", agentId)
    .eq("org_id", orgId)
    .single();

  if (aErr || !agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Expected multipart field \"file\"" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }
  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json({ error: "Unsupported audio type" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `${orgId}/${agentId}/${Date.now()}-${safeName}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("voice-clones").upload(path, buf, {
    contentType: type,
    upsert: true,
  });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const prev = (agent.telephony_config as Record<string, unknown>) ?? {};
  let elevenlabsVoiceId: string | null = null;
  if (process.env.ELEVENLABS_API_KEY) {
    const created = await createElevenLabsVoiceFromSample({
      name: `swarsales-${agentId.slice(0, 8)}`,
      audioBuffer: buf,
      filename: safeName || `sample.${type.includes("wav") ? "wav" : "mp3"}`,
    });
    elevenlabsVoiceId = created?.voiceId ?? null;
  }

  const telephony_config = {
    ...prev,
    voiceClone: {
      storagePath: path,
      contentType: type,
      uploadedAt: new Date().toISOString(),
      elevenlabsVoiceId,
      note: elevenlabsVoiceId
        ? "ElevenLabs IVC created — set agent provider stack to deepgram_elevenlabs_openai and voiceId to this voice id."
        : "Upload received; add ELEVENLABS_API_KEY for automatic ElevenLabs voice creation.",
    },
  };

  await supabase.from("agents").update({ telephony_config }).eq("id", agentId);

  return NextResponse.json({ ok: true, storagePath: path, elevenlabsVoiceId });
}
