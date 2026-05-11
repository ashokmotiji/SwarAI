import { createHmac } from "crypto";

export type OrgSettings = Record<string, unknown>;

export interface CrmSyncPayload {
  callId: string;
  orgId: string;
  agentId?: string;
  customerPhone?: string;
  transcript?: any;
  summary?: string;
  sentiment?: string;
  orderValue?: number;
  conversionRate?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export async function syncToCrm(settings: OrgSettings | null | undefined, payload: CrmSyncPayload): Promise<void> {
  const providers = ["hubspot", "salesforce", "zoho"] as const;

  for (const provider of providers) {
    const config = settings?.[`${provider}Config`] as Record<string, any> | undefined;
    if (config?.enabled && config?.webhookUrl) {
      const url = config.webhookUrl;
      const secret = config.webhookSecret || process.env.SWARSALES_CRM_WEBHOOK_SECRET || "";

      const body = JSON.stringify({
        source: "swarsales-ai",
        provider,
        timestamp: new Date().toISOString(),
        data: payload
      });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (secret) {
        const sig = createHmac("sha256", secret).update(body).digest("hex");
        headers["x-swarsales-signature"] = `sha256=${sig}`;
      }

      await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      }).catch((e) => console.error(`CRM sync failed for ${provider}:`, e));
    }
  }
}
