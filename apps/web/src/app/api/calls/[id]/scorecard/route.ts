import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const callId = searchParams.get("callId");

  if (!callId) {
    return NextResponse.json({ error: "Missing callId" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("performance_scorecards")
    .select("*")
    .eq("call_id", callId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ scorecard: data });
}
