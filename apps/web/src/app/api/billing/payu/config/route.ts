import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pro = parseFloat(process.env.SWARSALES_PAYU_PRO_AMOUNT_INR ?? "999");
  const demo = parseFloat(process.env.SWARSALES_PAYU_DEMO_AMOUNT_INR ?? "100");
  return NextResponse.json({
    demoAmountInr: Number.isFinite(demo) && demo > 0 ? demo : 100,
    proAmountInr: Number.isFinite(pro) && pro > 0 ? pro : 999,
    mode: process.env.PAYU_MODE === "production" ? "production" : "test",
    callbackPath: "/api/billing/payu/callback",
  });
}
