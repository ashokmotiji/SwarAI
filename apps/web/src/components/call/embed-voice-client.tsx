"use client";

import { LiveKitRoom, RoomAudioRenderer, ControlBar } from "@livekit/components-react";
import "@livekit/components-styles";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EmbedVoiceClient({ agentId }: { agentId: string }) {
  const [url, setUrl] = useState<string | undefined>();
  const [token, setToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/embed/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setUrl(data.url);
      setToken(data.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  return (
    <Card className="mx-auto max-w-lg border-border">
      <CardHeader>
        <CardTitle>SwarSales AI voice</CardTitle>
        <CardDescription>Embedded session for agent {agentId.slice(0, 8)}…</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={start} disabled={loading}>
          {loading ? "Connecting…" : "Start"}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {url && token ? (
          <LiveKitRoom serverUrl={url} token={token} connect audio={true}>
            <RoomAudioRenderer />
            <div className="mt-4">
              <ControlBar controls={{ microphone: true, camera: false, screenShare: false }} />
            </div>
          </LiveKitRoom>
        ) : null}
      </CardContent>
    </Card>
  );
}
