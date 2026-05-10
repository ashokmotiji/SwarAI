import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPaymentReadiness } from "@/lib/payment-readiness";

/** Which payment integrations are configured (booleans only). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(getPaymentReadiness());
}
