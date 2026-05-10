import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";

async function mergePlan(orgId: string, plan: "pro" | "free", stripeMeta: Record<string, unknown>) {
  const supabase = createServiceClient();
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
  if (!org) return;
  const prev = (org.settings as Record<string, unknown>) ?? {};
  const prevStripe =
    typeof prev.stripe === "object" && prev.stripe ? (prev.stripe as Record<string, unknown>) : {};
  await supabase
    .from("organizations")
    .update({
      settings: {
        ...prev,
        plan,
        stripe: {
          ...prevStripe,
          ...stripeMeta,
          lastWebhookAt: new Date().toISOString(),
        },
      },
    })
    .eq("id", orgId);
}

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !whSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 501 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

  const stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        let orgId = session.metadata?.swarai_org_id ?? session.client_reference_id ?? null;
        const custId = typeof session.customer === "string" ? session.customer : null;
        if (!orgId && custId) {
          const c = await stripe.customers.retrieve(custId);
          if (!c.deleted && "metadata" in c && c.metadata?.org_id) {
            orgId = c.metadata.org_id;
          }
        }
        if (orgId && /^[0-9a-f-]{36}$/i.test(orgId)) {
          await mergePlan(orgId, "pro", {
            checkoutSessionId: session.id,
            subscriptionId:
              typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const metaOrg = sub.metadata?.swarai_org_id;
        if (metaOrg && /^[0-9a-f-]{36}$/i.test(metaOrg)) {
          await mergePlan(metaOrg, "free", { subscriptionId: sub.id, status: sub.status });
          break;
        }
        const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (!cust) break;
        const supabase = createServiceClient();
        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", cust)
          .maybeSingle();
        if (org?.id) {
          await mergePlan(org.id, "free", { subscriptionId: sub.id, status: sub.status });
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
