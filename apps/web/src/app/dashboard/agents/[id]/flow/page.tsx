import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";
import { AgentFlowEditor } from "@/components/agents/agent-flow-editor";

export default async function AgentFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data: agent } = await supabase.from("agents").select("id, name").eq("id", id).eq("org_id", orgId).single();
  if (!agent) notFound();

  return <AgentFlowEditor agentId={agent.id} agentName={agent.name} />;
}
