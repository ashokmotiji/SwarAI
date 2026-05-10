import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentConfigSchema } from "@swarai/core";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

const BodySchema = z.object({
  templateId: z.string().uuid(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: tpl, error } = await supabase.from("marketplace_templates").select("*").eq("id", body.templateId).single();
  if (error || !tpl) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const raw = tpl.template_agent as Record<string, unknown>;
  const parsed = AgentConfigSchema.safeParse({
    ...raw,
    name: String(raw.name ?? tpl.title),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid template payload" }, { status: 500 });
  }
  const a = parsed.data;

  const { data: agent, error: insErr } = await supabase
    .from("agents")
    .insert({
      org_id: orgId,
      name: a.name,
      system_prompt: a.systemPrompt,
      default_language: a.defaultLanguage,
      supported_languages: a.supportedLanguages,
      voice_id: a.voiceId,
      provider_stack: a.providerStack,
      hinglish_friendly: a.hinglishFriendly,
      status: "draft",
    })
    .select("*")
    .single();

  if (insErr || !agent) {
    return NextResponse.json({ error: insErr?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ agent });
}
