import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { TopBar } from "@/components/dashboard/top-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AgentsPage() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data: agents } = await supabase.from("agents").select("*").eq("org_id", orgId).order("updated_at", { ascending: false });

  return (
    <>
      <TopBar title="Agents" />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Configure Sarvam voices, languages, and tools.</p>
          <Button asChild>
            <Link href="/dashboard/agents/new">New agent</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(agents ?? []).map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{a.system_prompt}</CardDescription>
                </div>
                <Badge variant="primary">{a.status}</Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Voice: {a.voice_id}</span>
                <span>·</span>
                <span>Stack: {a.provider_stack}</span>
                <span>·</span>
                <span>Lang: {a.default_language}</span>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href={`/dashboard/agents/${a.id}`}>Edit</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {(agents ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No agents yet. Create one or install from the marketplace.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
