import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentConfigSchema } from "@swarsales/core";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeE164 } from "@/lib/normalize-e164";

const PatchSchema = AgentConfigSchema.partial().extend({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  /** Inbound PSTN DID (E.164) for one-agent-per-number routing; stored in telephony_config.inboundE164 */
  inboundE164: z.union([z.string().max(24), z.null()]).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const row: Record<string, unknown> = {};
  if (body.name != null) row.name = body.name;
  if (body.systemPrompt != null) row.system_prompt = body.systemPrompt;
  if (body.defaultLanguage != null) row.default_language = body.defaultLanguage;
  if (body.supportedLanguages != null) row.supported_languages = body.supportedLanguages;
  if (body.voiceId != null) row.voice_id = body.voiceId;
  if (body.providerStack != null) row.provider_stack = body.providerStack;
  if (body.hinglishFriendly != null) row.hinglish_friendly = body.hinglishFriendly;
  if (body.status != null) row.status = body.status;

  if (body.inboundE164 !== undefined) {
    const { data: existing, error: loadErr } = await supabase
      .from("agents")
      .select("telephony_config")
      .eq("id", id)
      .eq("org_id", orgId)
      .single();
    if (loadErr || !existing) {
      return NextResponse.json({ error: loadErr?.message ?? "Not found" }, { status: 404 });
    }
    const tc: Record<string, unknown> = {
      ...((existing.telephony_config as Record<string, unknown> | null) ?? {}),
    };
    const clearInbound =
      body.inboundE164 === null || (typeof body.inboundE164 === "string" && body.inboundE164.trim() === "");
    if (clearInbound) {
      delete tc.inboundE164;
    } else if (typeof body.inboundE164 === "string") {
      const normalized = normalizeE164(body.inboundE164);
      if (!normalized || normalized.length < 8) {
        return NextResponse.json({ error: "inboundE164 must look like E.164 (e.g. +9198xxxxxxx)" }, { status: 400 });
      }
      const { data: clash } = await supabase
        .from("agents")
        .select("id")
        .eq("org_id", orgId)
        .neq("id", id)
        .contains("telephony_config", { inboundE164: normalized })
        .limit(1);
      if (clash?.length) {
        return NextResponse.json(
          { error: "Another agent in this workspace already uses this inbound number." },
          { status: 409 },
        );
      }
      tc.inboundE164 = normalized;
    } else {
      return NextResponse.json({ error: "Invalid inboundE164" }, { status: 400 });
    }
    row.telephony_config = tc as never;
  }

  if (Object.keys(row).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("agents")
    .update(row)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });
  }
  return NextResponse.json({ agent: data });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("agents").select("*").eq("id", id).eq("org_id", orgId).single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ agent: data });
}
