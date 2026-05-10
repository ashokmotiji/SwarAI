"use client";

import { LiveKitRoom, RoomAudioRenderer, ControlBar } from "@livekit/components-react";
import { useRoomInfo } from "@livekit/components-react/hooks";
import "@livekit/components-styles";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  agents: { id: string; name: string }[];
};

const MID_LANGS = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
  { id: "ta", label: "Tamil" },
  { id: "te", label: "Telugu" },
  { id: "kn", label: "Kannada" },
  { id: "ml", label: "Malayalam" },
  { id: "bn", label: "Bengali" },
  { id: "mr", label: "Marathi" },
  { id: "auto", label: "Auto" },
];

function MidCallLanguageBar({ callId }: { callId: string }) {
  const { name: roomName } = useRoomInfo();
  const [lang, setLang] = useState("en");
  const [status, setStatus] = useState<string | null>(null);

  async function apply() {
    setStatus(null);
    const name = roomName;
    if (!name) {
      setStatus("Not connected");
      return;
    }
    const res = await fetch("/api/livekit/room-language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName: name, callId, defaultLanguage: lang }),
    });
    const j = await res.json();
    setStatus(res.ok ? `Language → ${lang}` : j.error || "Failed");
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">Mid-call language (updates LiveKit room metadata)</p>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={lang} onValueChange={setLang}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MID_LANGS.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="secondary" onClick={() => void apply()}>
          Apply
        </Button>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}

export function SimulatorClient({ agents }: Props) {
  const [agentId, setAgentId] = useState<string | undefined>(agents[0]?.id);
  const [url, setUrl] = useState<string | undefined>();
  const [token, setToken] = useState<string | undefined>();
  const [roomName, setRoomName] = useState<string | undefined>();
  const [callId, setCallId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agentId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start");
      }
      setUrl(data.url);
      setToken(data.token);
      setRoomName(data.roomName);
      setCallId(data.callId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setUrl(undefined);
      setToken(undefined);
      setRoomName(undefined);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const stop = useCallback(() => {
    setUrl(undefined);
    setToken(undefined);
    setRoomName(undefined);
    setCallId(undefined);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Start a browser voice session. Run the Python worker against the same LiveKit project.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {agents.length > 0 ? (
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Default prompt" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No agents yet — create one first, or use the default prompt.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={start} disabled={loading}>
              {loading ? "Connecting…" : "Start voice"}
            </Button>
            <Button variant="outline" onClick={stop} disabled={!token}>
              Stop
            </Button>
          </div>
          {roomName ? <p className="text-xs text-muted-foreground">Room: {roomName}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="min-h-[320px]">
        <CardHeader>
          <CardTitle>Live audio</CardTitle>
          <CardDescription>Microphone is published to LiveKit; agent worker joins with Sarvam STT/TTS/LLM.</CardDescription>
        </CardHeader>
        <CardContent>
          {url && token ? (
            <LiveKitRoom serverUrl={url} token={token} connect audio={true} connectOptions={{ autoSubscribe: true }}>
              <RoomAudioRenderer />
              <div className="mt-4">
                <ControlBar controls={{ microphone: true, camera: false, screenShare: false }} />
              </div>
              {callId ? <MidCallLanguageBar callId={callId} /> : null}
            </LiveKitRoom>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              Start a session to connect.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
