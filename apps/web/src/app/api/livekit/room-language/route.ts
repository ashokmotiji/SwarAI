import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { mergeRoomMetadata } from "@/lib/livekit";
import { rateLimitResponse } from "@/lib/rate-limit";
import { INDIAN_LANGUAGES } from "@swarai/core";

const LANGS = [...INDIAN_LANGUAGES] as [string, ...string[]];

const BodySchema = z.object({
  roomName: z.string().min(1),
  callId: z.string().uuid(),
  defaultLanguage: z.enum(LANGS),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("livekit-room-language", userId, 60, 60);
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
    .select("id, org_id, livekit_room")
    .eq("id", body.callId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !call || call.livekit_room !== body.roomName) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  try {
    await mergeRoomMetadata(body.roomName, { defaultLanguage: body.defaultLanguage });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "LiveKit error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, defaultLanguage: body.defaultLanguage });
}
