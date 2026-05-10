import { EmbedVoiceClient } from "@/components/call/embed-voice-client";

export default async function EmbedPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  return (
    <div className="min-h-dvh bg-background p-4">
      <EmbedVoiceClient agentId={agentId} />
    </div>
  );
}
