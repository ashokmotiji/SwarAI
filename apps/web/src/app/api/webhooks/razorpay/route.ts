import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { applyRazorpayWebhook } from "@/lib/razorpay-billing-sync";

/**
 * Razorpay webhook — verify `X-Razorpay-Signature` = HMAC-SHA256(webhook_secret, raw_body).
 * Persists idempotent rows in `razorpay_webhook_events` and updates org `settings.plan` / `settings.razorpay`
 * when payload notes include `swarai_org_id` (set on orders created via the dashboard API).
 * @see https://razorpay.com/docs/webhooks/validate-test/
 */
export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const rawBody = await req.text();

  if (secret) {
    const sig = req.headers.get("x-razorpay-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    try {
      if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { duplicate } = await applyRazorpayWebhook(rawBody, body);
    return NextResponse.json({ received: true, duplicate });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}
