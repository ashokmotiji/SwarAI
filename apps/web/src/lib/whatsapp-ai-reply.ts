import { createServiceClient } from "@/lib/supabase/service";
import { systemPromptWithFlow } from "@/lib/agent-prompt";
import { searchKnowledgeHybrid } from "@/lib/knowledge-pinecone";
import { downloadMedia, getMediaUrl, sendWhatsAppText, type WaInboundMessage } from "@/lib/whatsapp-cloud";

async function transcribeOpenAI(audio: Buffer, mime: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "";
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("webm") ? "webm" : "mp3";
  const form = new FormData();
  form.append("model", "whisper-1");
  const file = new File([new Uint8Array(audio)], `voice.${ext}`, { type: mime || "application/octet-stream" });
  form.append("file", file);
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { text?: string };
  return data.text?.trim() ?? "";
}

async function chatReply(systemPrompt: string, userText: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return "Configure OPENAI_API_KEY for WhatsApp AI replies.";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.SWARAI_WHATSAPP_LLM_MODEL ?? "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt + "\n\nKeep replies short for WhatsApp (under 900 chars). Be helpful and India-aware when relevant." },
        { role: "user", content: userText.slice(0, 12000) },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return "Sorry, I could not generate a reply right now.";
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || "…";
}

export async function handleWhatsAppInbound(msg: WaInboundMessage): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const agentId = process.env.WHATSAPP_LINKED_AGENT_ID;
  if (!accessToken || !phoneNumberId || !agentId) {
    return;
  }

  const supabase = createServiceClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("id, org_id, system_prompt, status")
    .eq("id", agentId)
    .eq("status", "active")
    .maybeSingle();

  if (!agent) return;

  let userText = "";
  if (msg.type === "text" && msg.text?.body) {
    userText = msg.text.body;
  } else if (msg.type === "audio" && msg.audio?.id) {
    const url = await getMediaUrl(msg.audio.id, accessToken);
    if (!url) return;
    const buf = await downloadMedia(url, accessToken);
    if (!buf?.length) return;
    userText = await transcribeOpenAI(buf, "audio/ogg");
  } else {
    return;
  }

  if (!userText) {
    await sendWhatsAppText(msg.from, "I could not understand the audio. Try a text message or a clearer recording.", phoneNumberId, accessToken);
    return;
  }

  const basePrompt = await systemPromptWithFlow(supabase, agent.id, agent.system_prompt);
  const rag = await searchKnowledgeHybrid(agent.id, userText, 6);
  const systemPrompt = rag
    ? `${basePrompt}\n\nRelevant knowledge snippets:\n${rag.slice(0, 6000)}`
    : basePrompt;

  const reply = await chatReply(systemPrompt, userText);
  await sendWhatsAppText(msg.from, reply, phoneNumberId, accessToken);
}
