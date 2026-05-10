const GRAPH = "https://graph.facebook.com/v21.0";

export async function getMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}

export async function downloadMedia(mediaUrl: string, accessToken: string): Promise<Buffer | null> {
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

export async function sendWhatsAppText(to: string, body: string, phoneNumberId: string, accessToken: string): Promise<boolean> {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4096) },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  return res.ok;
}

export type WaInboundMessage = { from: string; type: string; id?: string; text?: { body?: string }; audio?: { id?: string } };

export function extractInboundMessages(payload: unknown): WaInboundMessage[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { entry?: { changes?: { value?: { messages?: unknown[] } }[] }[] };
  const out: WaInboundMessage[] = [];
  for (const e of root.entry ?? []) {
    for (const c of e.changes ?? []) {
      const msgs = c.value?.messages;
      if (!Array.isArray(msgs)) continue;
      for (const m of msgs) {
        if (m && typeof m === "object" && "from" in m && "type" in m) {
          out.push(m as WaInboundMessage);
        }
      }
    }
  }
  return out;
}
