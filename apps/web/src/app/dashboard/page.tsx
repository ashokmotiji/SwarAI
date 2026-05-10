import { auth, currentUser } from "@clerk/nextjs/server";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function DashboardHomePage() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();

  const [{ count: callCount }, { count: agentCount }, { data: recent }] = await Promise.all([
    supabase.from("calls").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("agents").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabase.from("calls").select("id, channel, status, started_at").eq("org_id", orgId).order("started_at", { ascending: false }).limit(5),
  ]);

  return (
    <>
      <TopBar title={`Welcome${user?.firstName ? `, ${user.firstName}` : ""}`} />
      <div className="space-y-8 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Calls (all time)</CardDescription>
              <CardTitle className="text-3xl">{callCount ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Agents</CardDescription>
              <CardTitle className="text-3xl">{agentCount ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Quick action</CardDescription>
              <CardTitle className="text-lg">Test voice</CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/simulator">Open simulator</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent calls</CardTitle>
            <CardDescription>Latest sessions across web, phone, and embed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {(recent ?? []).length === 0 ? (
                <li className="py-6 text-muted-foreground">No calls yet — start the simulator.</li>
              ) : (
                (recent ?? []).map((c) => (
                  <li key={c.id} className="flex justify-between py-3">
                    <span className="font-mono text-xs text-muted-foreground">{c.id.slice(0, 8)}…</span>
                    <span>{c.channel}</span>
                    <span className="text-muted-foreground">{c.status}</span>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
