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
    .select("id, status, channel, started_at, ended_at, sentiment_score, order_value, duration_seconds")
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
  // const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : null;
  const sentimentAvg =
    completed.length > 0
      ? completed.reduce((a, c) => a + (Number(c.sentiment_score) || 0), 0) / completed.length
      : null;

  const totalOrderValue = list.reduce((a, c) => a + (Number(c.order_value) || 0), 0);
  const conversionRate = list.length > 0 ? (list.filter((c) => (Number(c.order_value) || 0) > 0).length / list.length) * 100 : 0;
  const totalDuration = list.reduce((a, c) => a + (Number(c.duration_seconds) || 0), 0);

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
      <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{list.length}</div>
            <p className="text-xs text-muted-foreground">{completed.length} completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Based on order value</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{totalOrderValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">ROI from sales agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Sentiment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentimentAvg != null ? sentimentAvg.toFixed(2) : "n/a"}</div>
            <p className="text-xs text-muted-foreground">Customer satisfaction</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Channel Distribution</CardTitle>
            <CardDescription>Calls by ingress channel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-4">
              {Object.entries(byChannel).map(([ch, count]) => (
                <div key={ch} className="flex flex-col">
                  <span className="text-xs uppercase text-muted-foreground">{ch}</span>
                  <span className="text-lg font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Session Metrics</CardTitle>
            <CardDescription>Duration and p50/p95 latency.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Duration</p>
              <p className="font-semibold">{(totalDuration / 60).toFixed(1)} min</p>
            </div>
            <div>
              <p className="text-muted-foreground">p50 Latency</p>
              <p className="font-semibold">{p50 != null ? `${p50} ms` : "n/a"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
