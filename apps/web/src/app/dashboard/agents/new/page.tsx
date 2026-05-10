import { TopBar } from "@/components/dashboard/top-bar";
import { AgentEditorForm } from "@/components/agents/agent-editor-form";

export default function NewAgentPage() {
  return (
    <>
      <TopBar title="New agent" />
      <div className="max-w-3xl p-6">
        <AgentEditorForm />
      </div>
    </>
  );
}
