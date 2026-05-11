import { NextResponse } from "next/server";
import Redis from "ioredis";
import { createServiceClient } from "@/lib/supabase/service";
import { getPaymentReadiness } from "@/lib/payment-readiness";

export async function GET() {
  const checks: Record<string, string> = { web: "ok" };
  const pay = getPaymentReadiness();

  if (process.env.REDIS_URL) {
    try {
      const r = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
      await r.ping();
      r.disconnect();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
  } else {
    checks.redis = "skipped";
  }

  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("organizations").select("id").limit(1);
    checks.supabase = error ? "error" : "ok";
  } catch {
    checks.supabase = "error";
  }

  const ok = checks.redis !== "error" && checks.supabase !== "error";
  return NextResponse.json(
    {
      ok,
      service: "swarsales-web",
      checks,
      payments: {
        anyChargePath: pay.anyChargePath,
        planSyncReady: pay.planSyncReady,
        stripeCheckout: pay.stripe.checkout,
        stripeWebhook: pay.stripe.webhook,
        razorpayApi: pay.razorpay.api,
        razorpayWebhook: pay.razorpay.webhook,
        payuHosted: pay.payu.hostedCheckout,
        appUrl: pay.appUrl,
      },
    },
    { status: ok ? 200 : 503 },
  );
}
