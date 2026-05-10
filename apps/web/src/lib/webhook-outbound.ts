import { createHmac, timingSafeEqual } from "crypto";

export type OrgSettings = Record<string, unknown>;

export function getCrmWebhookUrl(settings: OrgSettings | null | undefined): string | null {
  const raw = settings?.crmWebhookUrl;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    new URL(raw);
    return raw.trim();
  } catch {
    return null;
  }
}

export function getCallCompletedWebhookUrl(settings: OrgSettings | null | undefined): string | null {
  const raw = settings?.callCompletedWebhookUrl;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    new URL(raw);
    return raw.trim();
  } catch {
    return null;
  }
}

export async function dispatchCallCompletedWebhook(
  settings: OrgSettings | null | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = getCallCompletedWebhookUrl(settings);
  if (!url) return;

  const secret =
    (typeof settings?.callCompletedWebhookSecret === "string" && settings.callCompletedWebhookSecret) ||
    process.env.SWARAI_WEBHOOK_SIGNING_SECRET ||
    "";

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    const sig = createHmac("sha256", secret).update(body).digest("hex");
    headers["x-swarai-signature"] = `sha256=${sig}`;
  }

  await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(12_000),
  }).catch(() => undefined);

  const crmUrl = getCrmWebhookUrl(settings);
  if (crmUrl) {
    const crmSecret =
      (typeof settings?.crmWebhookSecret === "string" && settings.crmWebhookSecret) ||
      process.env.SWARAI_CRM_WEBHOOK_SECRET ||
      "";
    const crmHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (crmSecret) {
      crmHeaders["x-swarai-signature"] = `sha256=${createHmac("sha256", crmSecret).update(body).digest("hex")}`;
    }
    await fetch(crmUrl, {
      method: "POST",
      headers: crmHeaders,
      body,
      signal: AbortSignal.timeout(12_000),
    }).catch(() => undefined);
  }
}

export function verifyMetaWhatsAppSignature(rawBody: string, signature256: string | null, appSecret: string): boolean {
  if (!signature256 || !signature256.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(signature256), Buffer.from(expected));
  } catch {
    return false;
  }
}
