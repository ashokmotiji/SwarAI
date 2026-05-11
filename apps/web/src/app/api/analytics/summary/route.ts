import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: calls, error } = await supabase
    .from("calls")
    .select("id, status, channel, started_at, ended_at, sentiment_score, order_value, duration_seconds")
    .eq("org_id", orgId)
    .gte("started_at", since);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = calls ?? [];
  const completed = list.filter((c) => c.status === "completed");
  const latencies = completed
    .map((c) => {
      if (!c.ended_at) return null;
      return new Date(c.ended_at).getTime() - new Date(c.started_at).getTime();
    })
    .filter((n): n is number => n != null && !Number.isNaN(n))
    .sort((a, b) => a - b);

  const p50 = latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : null;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : null;

  const sentimentAvg =
    completed.length > 0
      ? completed.reduce((a, c) => a + (Number(c.sentiment_score) || 0), 0) / completed.length
      : null;

  const totalOrderValue = list.reduce((a, c) => a + (Number(c.order_value) || 0), 0);
  const conversionRate = list.length > 0 ? (list.filter((c) => (Number(c.order_value) || 0) > 0).length / list.length) * 100 : 0;
  const totalDuration = list.reduce((a, c) => a + (Number(c.duration_seconds) || 0), 0);

  return NextResponse.json({
    windowDays: 30,
    totalCalls: list.length,
    completedCalls: completed.length,
    byChannel: groupBy(list, (c) => c.channel),
    latencyMs: { p50, p95 },
    sentimentAvg,
    totalOrderValue,
    conversionRate,
    totalDuration,
  });
}

function groupBy<T>(arr: T[], key: (t: T) => string) {
  return arr.reduce(
    (acc, item) => {
      const k = key(item);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}
