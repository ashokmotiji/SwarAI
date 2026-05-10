import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export default async function CallsPage() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data: calls } = await supabase
    .from("calls")
    .select("id, channel, status, started_at, ended_at, sentiment_score, livekit_room")
    .eq("org_id", orgId)
    .order("started_at", { ascending: false })
    .limit(80);

  return (
    <>
      <TopBar title="Call history" />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Transcripts & sentiment</CardTitle>
            <CardDescription>Completed calls include JSON transcripts once the worker posts back.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Channel</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Sentiment</th>
                    <th className="py-2 pr-4">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {(calls ?? []).map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-mono text-xs">
                        <Link className="text-primary underline-offset-4 hover:underline" href={`/dashboard/calls/${c.id}`}>
                          {c.id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td className="py-3 pr-4">{c.channel}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary">{c.status}</Badge>
                      </td>
                      <td className="py-3 pr-4">{c.sentiment_score ?? "—"}</td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">{c.livekit_room ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
