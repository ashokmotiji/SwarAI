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
  const { data: scorecard } = await supabase.from("performance_scorecards").select("*").eq("call_id", id).maybeSingle();

  return (
    <>
      <TopBar title={`Call ${id.slice(0, 8)}…`} />
      <div className="space-y-6 p-6">
        {scorecard && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Performance Scorecard</CardTitle>
                <div className="text-2xl font-bold text-primary">{scorecard.overall_score}/10</div>
              </div>
              <CardDescription>AI-generated coaching and feedback.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-3">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Strengths</p>
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {scorecard.strengths?.map((s: string) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Improvements</p>
                  <ul className="mt-2 list-inside list-disc text-sm">
                    {scorecard.areas_for_improvement?.map((s: string) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              </div>
              <div className="space-y-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Coaching Suggestions</p>
                <p className="text-sm italic text-muted-foreground">{scorecard.coaching_suggestions}</p>
                <div className="grid grid-cols-3 gap-4 border-t pt-4">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Objections</p>
                    <p className="text-lg font-bold">{scorecard.objection_handling_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Tone</p>
                    <p className="text-lg font-bold">{scorecard.tone_score}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase">Knowledge</p>
                    <p className="text-lg font-bold">{scorecard.product_knowledge_score}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
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
