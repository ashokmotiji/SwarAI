/** Optional LLM sentiment when OPENAI_API_KEY is set (overrides heuristic when successful). */
export async function scoreSentimentWithOpenAI(text: string): Promise<{ label: string; score: number } | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || text.length < 20) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.SWARAI_SENTIMENT_MODEL ?? "gpt-4o-mini",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              'Reply with a single JSON object only: {"label":"positive"|"negative"|"neutral"|"mixed","score": number} where score is between -1 and 1. Judge Indian customer-support style transcripts (Hinglish ok).',
          },
          { role: "user", content: text.slice(0, 12000) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    let raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const json = JSON.parse(raw) as { label?: string; score?: number };
    const label = typeof json.label === "string" ? json.label : "neutral";
    const score = typeof json.score === "number" ? Math.max(-1, Math.min(1, json.score)) : 0;
    return { label, score };
  } catch {
    return null;
  }
}
