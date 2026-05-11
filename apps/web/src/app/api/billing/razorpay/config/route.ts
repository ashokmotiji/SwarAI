import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Public to signed-in users: amounts only (no secrets). */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pro = parseInt(process.env.SWARSALES_RAZORPAY_PRO_AMOUNT_PAISE ?? "99900", 10);
  const min = parseInt(process.env.SWARSALES_RAZORPAY_PRO_MIN_PAISE ?? "0", 10);
  return NextResponse.json({
    proAmountPaise: Number.isFinite(pro) && pro > 0 ? pro : 99900,
    proMinPaise: Number.isFinite(min) && min > 0 ? min : null,
    webhookPath: "/api/webhooks/razorpay",
  });
}
