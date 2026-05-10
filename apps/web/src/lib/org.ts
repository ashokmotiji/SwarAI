import { createServiceClient } from "@/lib/supabase/service";

export async function ensurePersonalOrg(userId: string, email: string | null) {
  const supabase = createServiceClient();
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membership?.org_id) {
    return membership.org_id as string;
  }

  const label = email?.split("@")[0] || "My";
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      name: `${label} workspace`,
      settings: { plan: "free" },
    })
    .select("id")
    .single();
  if (orgErr || !org) {
    throw new Error(orgErr?.message || "Failed to create organization");
  }

  const { error: memErr } = await supabase.from("organization_members").insert({
    org_id: org.id,
    user_id: userId,
    role: "owner",
  });
  if (memErr) {
    throw new Error(memErr.message);
  }

  await supabase.from("profiles").upsert({
    id: userId,
    email: email ?? undefined,
    updated_at: new Date().toISOString(),
  });

  return org.id as string;
}
