import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { TopBar } from "@/components/dashboard/top-bar";
import { AgentEditorForm } from "@/components/agents/agent-editor-form";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export default async function EditAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).eq("org_id", orgId).single();
  if (!agent) notFound();

  return (
    <>
      <TopBar title={`Edit · ${agent.name}`} />
      <div className="max-w-3xl p-6">
        <AgentEditorForm agent={agent} />
      </div>
    </>
  );
}
