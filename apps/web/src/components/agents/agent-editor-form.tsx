"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { INDIA_CONTEXT_TEMPLATES } from "@/lib/prompt-templates";
import { SARVAM_SPEAKERS } from "@/lib/voices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const LANGS = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
  { id: "ta", label: "Tamil" },
  { id: "te", label: "Telugu" },
  { id: "kn", label: "Kannada" },
  { id: "ml", label: "Malayalam" },
  { id: "bn", label: "Bengali" },
  { id: "mr", label: "Marathi" },
  { id: "gu", label: "Gujarati" },
  { id: "pa", label: "Punjabi" },
  { id: "or", label: "Odia" },
  { id: "auto", label: "Auto / mixed" },
];

type AgentRow = {
  id: string;
  name: string;
  system_prompt: string;
  default_language: string;
  supported_languages: string[];
  voice_id: string;
  provider_stack: string;
  hinglish_friendly: boolean;
  status: string;
  telephony_config?: Record<string, unknown> | null;
};

export function AgentEditorForm({ agent }: { agent?: AgentRow }) {
  const router = useRouter();
  const [name, setName] = useState(agent?.name ?? "");
  const [prompt, setPrompt] = useState(
    agent?.system_prompt ??
      "You are SwarAI, a professional voice agent for Indian customers. Keep replies short and clear.",
  );
  const [defaultLanguage, setDefaultLanguage] = useState(agent?.default_language ?? "en");
  const [supported, setSupported] = useState<string[]>(agent?.supported_languages ?? ["en", "hi", "auto"]);
  const [voice, setVoice] = useState(agent?.voice_id ?? "anushka");
  const [stack, setStack] = useState(agent?.provider_stack ?? "sarvam");
  const [hinglish, setHinglish] = useState(agent?.hinglish_friendly ?? true);
  const [inboundE164, setInboundE164] = useState(
    typeof agent?.telephony_config?.inboundE164 === "string" ? agent.telephony_config.inboundE164 : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeText, setKnowledgeText] = useState("");
  const [knowledgeMsg, setKnowledgeMsg] = useState<string | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleLang(id: string) {
    setSupported((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        name,
        systemPrompt: prompt,
        defaultLanguage,
        supportedLanguages: supported.length ? supported : ["en", "auto"],
        voiceId: voice,
        providerStack: stack,
        hinglishFriendly: hinglish,
      };
      const res = await fetch(agent ? `/api/agents/${agent.id}` : "/api/agents", {
        method: agent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          agent
            ? { ...payload, status: agent.status, inboundE164: inboundE164.trim() || null }
            : payload,
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      router.push("/dashboard/agents");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  const voiceClone =
    agent?.telephony_config &&
    typeof agent.telephony_config === "object" &&
    "voiceClone" in agent.telephony_config &&
    agent.telephony_config.voiceClone &&
    typeof agent.telephony_config.voiceClone === "object"
      ? (agent.telephony_config.voiceClone as {
          elevenlabsVoiceId?: string | null;
          storagePath?: string;
          note?: string;
        })
      : null;

  async function uploadVoiceSample(file: File) {
    if (!agent?.id) {
      setVoiceMsg("Save the agent first, then upload a voice sample.");
      return;
    }
    setVoiceMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/agents/${agent.id}/voice-sample`, { method: "POST", body: fd });
    const j = await res.json();
    if (res.ok) {
      const id = typeof j.elevenlabsVoiceId === "string" ? j.elevenlabsVoiceId : null;
      setVoiceMsg(
        id
          ? `Uploaded. ElevenLabs voice id: ${id}. Use “Apply clone to agent” or paste into Voice ID below.`
          : `Uploaded: ${j.storagePath}. Add ELEVENLABS_API_KEY on the server for automatic clone creation.`,
      );
      router.refresh();
    } else {
      setVoiceMsg(j.error || "Upload failed");
    }
  }

  async function ingestKnowledge() {
    if (!agent?.id) return;
    setKnowledgeMsg(null);
    setKnowledgeLoading(true);
    try {
      const res = await fetch("/api/ingestion/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
          title: knowledgeTitle.trim() || "Pasted knowledge",
          text: knowledgeText.trim(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Ingest failed");
      const pine =
        typeof j.pineconeUpserted === "number" && j.pineconeUpserted > 0
          ? ` Pinecone: ${j.pineconeUpserted} vectors.`
          : "";
      const warn = typeof j.pineconeWarning === "string" ? ` Pinecone warning: ${j.pineconeWarning}` : "";
      setKnowledgeMsg(
        `Indexed ${j.chunks ?? "?"} chunks (source ${j.sourceId}).${pine}${warn} Used for hybrid RAG when tools/WhatsApp query knowledge.`,
      );
      setKnowledgeTitle("");
      setKnowledgeText("");
    } catch (e) {
      setKnowledgeMsg(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function applyElevenLabsClone() {
    if (!agent?.id || !voiceClone?.elevenlabsVoiceId) return;
    setVoiceMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voiceId: voiceClone.elevenlabsVoiceId,
          providerStack: "deepgram_elevenlabs_openai",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Apply failed");
      setVoice(voiceClone.elevenlabsVoiceId);
      setStack("deepgram_elevenlabs_openai");
      setVoiceMsg("Voice ID and stack updated for ElevenLabs. Save if you change other fields.");
      router.refresh();
    } catch (e) {
      setVoiceMsg(e instanceof Error ? e.message : "Apply failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{agent ? "Edit agent" : "Create agent"}</CardTitle>
        <CardDescription>Defaults target Sarvam Bulbul v3 + Saaras v3 via the worker.</CardDescription>
        {agent?.id ? (
          <Button variant="outline" size="sm" className="mt-2 w-fit" asChild>
            <Link href={`/dashboard/agents/${agent.id}/flow`}>Open visual flow builder</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Indian context snippets</Label>
          <div className="flex flex-wrap gap-2">
            {INDIA_CONTEXT_TEMPLATES.map((t) => (
              <Button key={t.id} type="button" variant="outline" size="sm" onClick={() => setPrompt((p) => p + t.text)}>
                {t.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="prompt">System prompt</Label>
          <Textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-[200px]" />
        </div>
        {agent?.id ? (
          <div className="space-y-2 rounded-lg border border-dashed p-4">
            <Label htmlFor="inbound-e164">Inbound phone number (E.164)</Label>
            <Input
              id="inbound-e164"
              placeholder="+9198xxxxxxx"
              value={inboundE164}
              onChange={(e) => setInboundE164(e.target.value)}
              className="max-w-md"
            />
            <p className="text-muted-foreground text-xs">
              One agent per DID: set this to the Twilio / Exotel number you own. Inbound calls to that number route
              here after your carrier webhook points at{" "}
              <code className="text-[10px]">/api/webhooks/twilio/voice</code> or{" "}
              <code className="text-[10px]">/api/webhooks/exotel/voice</code> (no{" "}
              <code className="text-[10px]">room</code> query). Clear the field to remove routing.
            </p>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Default language</Label>
            <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{stack === "sarvam" ? "Voice (Sarvam)" : "Voice ID"}</Label>
            {stack === "sarvam" ? (
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SARVAM_SPEAKERS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={voice}
                onChange={(e) => setVoice(e.target.value)}
                placeholder="ElevenLabs voice_id or provider-specific id"
                className="font-mono text-sm"
              />
            )}
            {stack !== "sarvam" ? (
              <p className="text-xs text-muted-foreground">
                Non-Sarvam stacks expect a provider voice identifier (e.g. ElevenLabs IVC id from your clone upload).
              </p>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Supported languages</Label>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <Button
                key={l.id}
                type="button"
                size="sm"
                variant={supported.includes(l.id) ? "default" : "outline"}
                onClick={() => toggleLang(l.id)}
              >
                {l.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider stack</Label>
            <Select value={stack} onValueChange={setStack}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sarvam">Sarvam (default)</SelectItem>
                <SelectItem value="openai">OpenAI (bring your own keys)</SelectItem>
                <SelectItem value="deepgram_elevenlabs_openai">Deepgram + ElevenLabs + OpenAI</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hinglish} onChange={(e) => setHinglish(e.target.checked)} />
              Hinglish-friendly prompting
            </label>
          </div>
        </div>
        {agent?.id ? (
          <div className="space-y-3 rounded-lg border border-border/80 p-4">
            <div>
              <Label>Voice clone sample (~30s)</Label>
              <p className="text-xs text-muted-foreground">
                Stored in Supabase. With <code className="text-[10px]">ELEVENLABS_API_KEY</code> on the server, SwarAI
                creates an IVC and stores the id on the agent.
              </p>
            </div>
            {voiceClone?.storagePath ? (
              <p className="text-xs text-muted-foreground">
                Last file: <span className="font-mono">{voiceClone.storagePath}</span>
              </p>
            ) : null}
            {voiceClone?.elevenlabsVoiceId ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-3 text-xs">
                <span className="text-muted-foreground">ElevenLabs voice id</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono">{voiceClone.elevenlabsVoiceId}</code>
                <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => void applyElevenLabsClone()}>
                  Apply clone to agent
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void navigator.clipboard.writeText(voiceClone.elevenlabsVoiceId ?? "")}
                >
                  Copy id
                </Button>
              </div>
            ) : null}
            {voiceClone?.note ? <p className="text-xs text-muted-foreground">{voiceClone.note}</p> : null}
            <input
              ref={fileRef}
              type="file"
              accept="audio/wav,audio/mpeg,audio/webm,audio/ogg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadVoiceSample(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              Upload audio
            </Button>
            {voiceMsg ? <p className="text-xs text-muted-foreground">{voiceMsg}</p> : null}
          </div>
        ) : null}
        {agent?.id ? (
          <div className="space-y-3 rounded-lg border border-dashed border-border/80 p-4">
            <div>
              <Label>Knowledge base (RAG)</Label>
              <p className="text-xs text-muted-foreground">
                Paste FAQs or policy text to embed into Supabase pgvector for this agent. With <code className="text-[10px]">PINECONE_*</code>{" "}
                configured, vectors are also upserted (namespace = this agent&apos;s id). The worker&apos;s{" "}
                <code className="text-[10px]">search_knowledge</code> tool and WhatsApp use hybrid search (Pinecone first, then pgvector).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kn-title">Title</Label>
              <Input
                id="kn-title"
                value={knowledgeTitle}
                onChange={(e) => setKnowledgeTitle(e.target.value)}
                placeholder="e.g. Return policy — March 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kn-body">Text</Label>
              <Textarea
                id="kn-body"
                value={knowledgeText}
                onChange={(e) => setKnowledgeText(e.target.value)}
                className="min-h-[120px]"
                placeholder="Plain text or bullet points…"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={knowledgeLoading || knowledgeText.trim().length < 8}
              onClick={() => void ingestKnowledge()}
            >
              {knowledgeLoading ? "Indexing…" : "Add to knowledge index"}
            </Button>
            {knowledgeMsg ? <p className="text-xs text-muted-foreground">{knowledgeMsg}</p> : null}
          </div>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button onClick={save} disabled={loading}>
          {loading ? "Saving…" : "Save agent"}
        </Button>
      </CardContent>
    </Card>
  );
}
