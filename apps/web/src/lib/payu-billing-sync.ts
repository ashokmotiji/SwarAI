import { createServiceClient } from "@/lib/supabase/service";

type JsonRecord = Record<string, unknown>;

export async function applyPayuSuccess(orgId: string, intent: "demo" | "pro", txnid: string): Promise<void> {
  const supabase = createServiceClient();
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  if (!org) return;
  const prev = (org.settings as JsonRecord) ?? {};
  const prevPayu =
    typeof prev.payu === "object" && prev.payu ? (prev.payu as JsonRecord) : {};
  const nextSettings: JsonRecord = {
    ...prev,
    payu: {
      ...prevPayu,
      lastSuccessAt: new Date().toISOString(),
      lastTxnid: txnid,
    },
  };
  if (intent === "pro") nextSettings.plan = "pro";
  await supabase.from("organizations").update({ settings: nextSettings }).eq("id", orgId);
}
