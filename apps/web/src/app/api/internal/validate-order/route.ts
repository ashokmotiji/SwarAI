import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const secret = process.env.SWARSALES_INTERNAL_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-swarsales-internal") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Simple mock validation logic
  // In production, this would check a database or ERP system.
  return NextResponse.json({
    valid: true,
    summary: "3 units of Item A, 5 units of Item B. Total ₹4,500. Free delivery included.",
  });
}
