import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { ensurePersonalOrg } from "@/lib/org";

const BodySchema = z.object({
  amountPaise: z.number().int().positive().max(10_000_000),
  receipt: z.string().max(40).optional(),
  /** When `pro`, payment.captured upgrades org plan if webhook notes carry `swarai_org_id`. */
  intent: z.enum(["demo", "pro"]).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 501 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);

  const rzp = new Razorpay({ key_id: key, key_secret: secret });
  const notes: Record<string, string> = { swarai_org_id: orgId };
  if (body.intent === "pro") notes.swarai_plan = "pro";

  const order = await rzp.orders.create({
    amount: body.amountPaise,
    currency: "INR",
    receipt: body.receipt ?? `swarai_${userId.slice(0, 8)}`,
    payment_capture: true,
    notes,
  });

  return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: key });
}
