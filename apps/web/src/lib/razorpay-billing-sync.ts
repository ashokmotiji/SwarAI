import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

type JsonRecord = Record<string, unknown>;

function parseNotes(entity: JsonRecord): Record<string, string> {
  const n = entity.notes;
  if (!n || typeof n !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(n as JsonRecord)) {
    if (v != null && typeof v !== "object") out[k] = String(v);
  }
  return out;
}

function entitiesFromPayload(payload: unknown): JsonRecord[] {
  if (!payload || typeof payload !== "object") return [];
  const out: JsonRecord[] = [];
  for (const wrap of Object.values(payload as JsonRecord)) {
    if (wrap && typeof wrap === "object" && "entity" in wrap) {
      const e = (wrap as { entity: unknown }).entity;
      if (e && typeof e === "object") out.push(e as JsonRecord);
    }
  }
  return out;
}

/** Find SwarSales AI org id from Razorpay notes on nested payload entities. */
export function resolveOrgIdFromRazorpayBody(body: JsonRecord): string | null {
  const payload = body.payload;
  for (const ent of entitiesFromPayload(payload)) {
    const notes = parseNotes(ent);
    const id = notes.swarsales_org_id ?? notes.swai_org_id;
    if (id && /^[0-9a-f-]{36}$/i.test(id)) return id;
  }
  return null;
}

function firstEntityOfKind(payload: unknown, entityName: string): JsonRecord | null {
  for (const ent of entitiesFromPayload(payload)) {
    if (ent.entity === entityName) return ent;
  }
  for (const ent of entitiesFromPayload(payload)) {
    if (entityName === "payment" && ent.amount != null) return ent;
    if (entityName === "subscription" && ent.plan_id != null) return ent;
  }
  return null;
}

function stableEventId(body: JsonRecord, rawBody: string): string {
  const id = typeof body.id === "string" ? body.id : null;
  if (id?.startsWith("evt_")) return id;
  const ev = typeof body.event === "string" ? body.event : "unknown";
  const h = createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
  return `evt_derived_${ev}_${h}`;
}

async function upsertWebhookEvent(params: {
  razorpayEventId: string;
  orgId: string | null;
  eventType: string;
  summary: JsonRecord;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("razorpay_webhook_events").insert({
    razorpay_event_id: params.razorpayEventId,
    org_id: params.orgId,
    event_type: params.eventType,
    summary: params.summary,
  });
  if (error?.code === "23505") return false;
  if (error) throw new Error(error.message);
  return true;
}

async function writeOrgBilling(orgId: string, next: { settings: JsonRecord; razorpayCustomerId?: string }) {
  const supabase = createServiceClient();
  const row: JsonRecord = { settings: next.settings };
  if (next.razorpayCustomerId) row.razorpay_customer_id = next.razorpayCustomerId;
  await supabase.from("organizations").update(row).eq("id", orgId);
}

/** Apply verified Razorpay webhook: idempotent row + org billing hints when `swarsales_org_id` is present in notes. */
export async function applyRazorpayWebhook(rawBody: string, body: JsonRecord): Promise<{ duplicate: boolean }> {
  const eventType = typeof body.event === "string" ? body.event : "unknown";
  const eventId = stableEventId(body, rawBody);
  const orgId = resolveOrgIdFromRazorpayBody(body);
  const payload = body.payload;

  const payment = firstEntityOfKind(payload, "payment");
  const subscription = firstEntityOfKind(payload, "subscription");
  const notesFromPayment = payment ? parseNotes(payment) : {};
  const planIntent = notesFromPayment.swarsales_plan ?? notesFromPayment.swai_plan;

  const proMin = parseInt(process.env.SWARSALES_RAZORPAY_PRO_MIN_PAISE ?? "0", 10);
  const amountPaise =
    typeof payment?.amount === "number"
      ? payment.amount
      : typeof payment?.amount === "string"
        ? parseInt(payment.amount, 10)
        : 0;

  const qualifiesProByAmount = Number.isFinite(proMin) && proMin > 0 && amountPaise >= proMin;
  const qualifiesProByNote = planIntent === "pro";

  let planUpdate: "pro" | "free" | null = null;
  let customerId: string | undefined;

  const razorpayBlock: JsonRecord = {
    lastEventAt: new Date().toISOString(),
    lastEventType: eventType,
    lastEventId: eventId,
  };

  if (orgId) {
    if (eventType === "payment.captured" && payment) {
      razorpayBlock.lastPaymentId = typeof payment.id === "string" ? payment.id : undefined;
      razorpayBlock.lastPaymentAmountPaise = amountPaise;
      if (qualifiesProByNote || qualifiesProByAmount) planUpdate = "pro";
    } else if (eventType === "subscription.activated" && subscription) {
      razorpayBlock.subscriptionId = typeof subscription.id === "string" ? subscription.id : undefined;
      const cid = subscription.customer_id;
      if (typeof cid === "string" && cid) customerId = cid;
      else if (typeof cid === "number") customerId = String(cid);
      planUpdate = "pro";
    } else if (
      (eventType === "subscription.cancelled" || eventType === "subscription.completed") &&
      subscription
    ) {
      razorpayBlock.subscriptionEnded = true;
      planUpdate = "free";
    } else if (eventType === "subscription.charged" && subscription) {
      razorpayBlock.subscriptionId = typeof subscription.id === "string" ? subscription.id : undefined;
    } else if (payment || subscription) {
      /* metadata-only */ void 0;
    }
  }

  const inserted = await upsertWebhookEvent({
    razorpayEventId: eventId,
    orgId,
    eventType,
    summary: {
      orgResolved: Boolean(orgId),
      paymentId: payment && typeof payment.id === "string" ? payment.id : undefined,
      subscriptionId: subscription && typeof subscription.id === "string" ? subscription.id : undefined,
      planUpgrade: planUpdate === "pro",
    },
  });

  if (!inserted) return { duplicate: true };
  if (orgId && (payment || subscription || planUpdate)) {
    const supabase = createServiceClient();
    const { data: org } = await supabase.from("organizations").select("settings").eq("id", orgId).single();
    const prev = (org?.settings as JsonRecord) ?? {};
    const razorpayPrev =
      typeof prev.razorpay === "object" && prev.razorpay ? (prev.razorpay as JsonRecord) : {};
    const nextSettings: JsonRecord = {
      ...prev,
      razorpay: { ...razorpayPrev, ...razorpayBlock },
    };
    if (planUpdate === "pro") nextSettings.plan = "pro";
    if (planUpdate === "free") nextSettings.plan = "free";

    await writeOrgBilling(orgId, {
      settings: nextSettings,
      razorpayCustomerId: customerId,
    });
  }

  return { duplicate: false };
}
