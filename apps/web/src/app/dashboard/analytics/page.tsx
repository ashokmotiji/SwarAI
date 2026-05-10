import { auth, currentUser } from "@clerk/nextjs/server";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AnalyticsPage() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: calls } = await supabase
    .from("calls")
    .select("id, status, channel, started_at, ended_at, sentiment_score")
    .eq("org_id", orgId)
    .gte("started_at", since);

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

  const byChannel = list.reduce(
    (acc, c) => {
      acc[c.channel] = (acc[c.channel] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <>
      <TopBar title="Analytics & insights" />
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>30-day volume</CardTitle>
            <CardDescription>Calls ingested into Supabase for this workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Total: {list.length}</p>
            <p>Completed: {completed.length}</p>
            <p>By channel: {JSON.stringify(byChannel)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latency (client session, rough)</CardTitle>
            <CardDescription>p50 / p95 from started_at → ended_at timestamps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>p50: {p50 != null ? `${p50} ms` : "n/a"}</p>
            <p>p95: {p95 != null ? `${p95} ms` : "n/a"}</p>
            <p className="text-muted-foreground">Wire LiveKit + worker spans for true end-to-end metrics.</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Sentiment</CardTitle>
            <CardDescription>Heuristic post-call score averaged over completed calls.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">Average: {sentimentAvg != null ? sentimentAvg.toFixed(3) : "n/a"}</CardContent>
        </Card>
      </div>
    </>
  );
}
