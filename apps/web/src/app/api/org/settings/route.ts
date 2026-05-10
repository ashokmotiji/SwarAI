import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitResponse } from "@/lib/rate-limit";

const PatchSchema = z.object({
  callCompletedWebhookUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  callCompletedWebhookSecret: z.union([z.string().max(256), z.literal(""), z.null()]).optional(),
  crmWebhookUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  crmWebhookSecret: z.union([z.string().max(256), z.literal(""), z.null()]).optional(),
  plan: z.union([z.enum(["free", "pro", "enterprise"]), z.null()]).optional(),
  maxVoiceSessionsPerDay: z.union([z.number().int().min(1).max(100000), z.null()]).optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const s = (data?.settings as Record<string, unknown>) ?? {};
  return NextResponse.json({
    callCompletedWebhookUrl: typeof s.callCompletedWebhookUrl === "string" ? s.callCompletedWebhookUrl : "",
    hasWebhookSecret: typeof s.callCompletedWebhookSecret === "string" && s.callCompletedWebhookSecret.length > 0,
    crmWebhookUrl: typeof s.crmWebhookUrl === "string" ? s.crmWebhookUrl : "",
    hasCrmWebhookSecret: typeof s.crmWebhookSecret === "string" && s.crmWebhookSecret.length > 0,
    plan: typeof s.plan === "string" ? s.plan : null,
    maxVoiceSessionsPerDay: typeof s.maxVoiceSessionsPerDay === "number" ? s.maxVoiceSessionsPerDay : null,
  });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("org-settings", userId, 40, 60);
  if (limited) return limited;

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();

  const { data: org, error: readErr } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  if (readErr || !org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const prev = (org.settings as Record<string, unknown>) ?? {};
  const next: Record<string, unknown> = { ...prev };

  if (body.callCompletedWebhookUrl !== undefined) {
    next.callCompletedWebhookUrl = body.callCompletedWebhookUrl ?? "";
  }
  if (body.callCompletedWebhookSecret !== undefined) {
    next.callCompletedWebhookSecret = body.callCompletedWebhookSecret ?? "";
  }
  if (body.crmWebhookUrl !== undefined) {
    next.crmWebhookUrl = body.crmWebhookUrl ?? "";
  }
  if (body.crmWebhookSecret !== undefined) {
    next.crmWebhookSecret = body.crmWebhookSecret ?? "";
  }
  if (body.plan !== undefined) {
    if (body.plan === null) {
      delete next.plan;
    } else {
      next.plan = body.plan;
    }
  }
  if (body.maxVoiceSessionsPerDay !== undefined) {
    next.maxVoiceSessionsPerDay = body.maxVoiceSessionsPerDay;
  }

  const { error } = await supabase.from("organizations").update({ settings: next }).eq("id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
