import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data: call } = await supabase.from("calls").select("*").eq("id", id).eq("org_id", orgId).single();
  if (!call) notFound();

  const { data: sentiment } = await supabase.from("sentiment_events").select("*").eq("call_id", id);

  return (
    <>
      <TopBar title={`Call ${id.slice(0, 8)}…`} />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Transcript payload</CardTitle>
            <CardDescription>Raw history JSON from the LiveKit agent session.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[480px] overflow-auto rounded-lg bg-muted p-4 text-xs">
              {JSON.stringify(call.transcript ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sentiment events</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs">{JSON.stringify(sentiment ?? [], null, 2)}</pre>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
