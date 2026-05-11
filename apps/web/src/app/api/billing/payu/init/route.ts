import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitResponse } from "@/lib/rate-limit";
import { payuRequestHash } from "@/lib/payu-hash";

const BodySchema = z.object({
  intent: z.enum(["demo", "pro"]).default("demo"),
  /** Optional override; defaults from env / config. */
  amountInr: z.number().positive().max(1_000_000).optional(),
});

function payuBaseUrl(): string | null {
  if (process.env.PAYU_MODE === "production") return "https://secure.payu.in/_payment";
  return "https://test.payu.in/_payment";
}

function formatAmountInr(n: number): string {
  return n.toFixed(2);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await rateLimitResponse("payu-init", userId, 30, 3600);
  if (limited) return limited;

  const key = process.env.PAYU_MERCHANT_KEY?.trim();
  const salt = process.env.PAYU_MERCHANT_SALT?.trim();
  if (!key || !salt) {
    return NextResponse.json({ error: "PayU not configured (PAYU_MERCHANT_KEY / PAYU_MERCHANT_SALT)" }, { status: 501 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const demoDefault = parseFloat(process.env.SWARSALES_PAYU_DEMO_AMOUNT_INR ?? "100");
  const proDefault = parseFloat(process.env.SWARSALES_PAYU_PRO_AMOUNT_INR ?? "999");
  const amountNum =
    body.amountInr ??
    (body.intent === "pro" ? (Number.isFinite(proDefault) ? proDefault : 999) : Number.isFinite(demoDefault) ? demoDefault : 100);
  const amount = formatAmountInr(amountNum);

  // PayU txnid max length ~25; must be unique per attempt.
  const txnid = `S${Date.now().toString(36)}${nanoid(8)}`.replace(/-/g, "").slice(0, 25);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!appUrl) {
    return NextResponse.json({ error: "Set NEXT_PUBLIC_APP_URL for PayU surl/furl" }, { status: 501 });
  }

  const supabase = createServiceClient();
  const { error: insErr } = await supabase.from("payu_transactions").insert({
    txnid,
    org_id: orgId,
    amount,
    intent: body.intent,
  });
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  const email = user?.primaryEmailAddress?.emailAddress ?? "customer@example.com";
  const firstname =
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "Customer";
  const productinfo = body.intent === "pro" ? "SwarSales AI Pro" : "SwarSales AI demo";

  const udf1 = orgId;
  const udf2 = body.intent;

  const hash = payuRequestHash({
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    salt,
  });

  const surl = `${appUrl}/api/billing/payu/callback`;
  const furl = `${appUrl}/api/billing/payu/callback`;

  const actionUrl = payuBaseUrl();
  if (!actionUrl) return NextResponse.json({ error: "PayU base URL missing" }, { status: 500 });

  return NextResponse.json({
    actionUrl,
    fields: {
      key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      surl,
      furl,
      hash,
      udf1,
      udf2,
      service_provider: "payu_paisa",
    },
  });
}
