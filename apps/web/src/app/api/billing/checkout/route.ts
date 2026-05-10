import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Stripe not configured (STRIPE_SECRET_KEY)" }, { status: 501 });
  }

  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  const supabase = createServiceClient();

  const { data: org } = await supabase.from("organizations").select("stripe_customer_id, name").eq("id", orgId).single();

  let customerId = org?.stripe_customer_id ?? undefined;
  if (!customerId) {
    const c = await stripe.customers.create({
      name: org?.name ?? undefined,
      email: user?.primaryEmailAddress?.emailAddress ?? undefined,
      metadata: { org_id: orgId },
    });
    customerId = c.id;
    await supabase.from("organizations").update({ stripe_customer_id: customerId }).eq("id", orgId);
  }

  const price = process.env.STRIPE_PRO_PRICE_ID;
  if (!price) {
    return NextResponse.json({ error: "Set STRIPE_PRO_PRICE_ID for checkout." }, { status: 501 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: orgId,
    metadata: { swarai_org_id: orgId },
    subscription_data: {
      metadata: { swarai_org_id: orgId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?checkout=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
