import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Non-secret booleans: which server-side integrations are configured for this deployment. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    googleCalendar: Boolean(process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON?.trim()),
    pinecone: Boolean(process.env.PINECONE_API_KEY?.trim() && process.env.PINECONE_HOST?.trim()),
    whatsappCloud: Boolean(
      process.env.WHATSAPP_ACCESS_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
    ),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
    stripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim() && process.env.STRIPE_SECRET_KEY?.trim()),
    razorpayPayments: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
    razorpayWebhookSecret: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
    payu: Boolean(process.env.PAYU_MERCHANT_KEY?.trim() && process.env.PAYU_MERCHANT_SALT?.trim()),
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    redis: Boolean(process.env.REDIS_URL?.trim()),
  });
}
