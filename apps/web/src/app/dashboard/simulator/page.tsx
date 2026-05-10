import { auth, currentUser } from "@clerk/nextjs/server";
import { TopBar } from "@/components/dashboard/top-bar";
import { SimulatorClient } from "@/components/call/simulator-client";
import { ensurePersonalOrg } from "@/lib/org";
import { createServiceClient } from "@/lib/supabase/service";

export default async function SimulatorPage() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const orgId = await ensurePersonalOrg(userId, user?.primaryEmailAddress?.emailAddress ?? null);
  const supabase = createServiceClient();
  const { data: agents } = await supabase.from("agents").select("id, name").eq("org_id", orgId).eq("status", "active");

  return (
    <>
      <TopBar title="Call simulator" />
      <div className="p-6">
        <SimulatorClient agents={agents ?? []} />
      </div>
    </>
  );
}
