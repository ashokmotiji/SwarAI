/**
 * After every N completed calls, suggest a refined system prompt (OpenAI optional).
 */
export async function suggestPromptImprovement(input: {
  currentPrompt: string;
  transcriptSamples: string[];
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  const joined = input.transcriptSamples.slice(0, 8).join("\n---\n");
  if (!key) {
    return [
      "OpenAI API key not configured — manual review recommended.",
      "Patterns from recent calls (truncated):",
      joined.slice(0, 1200),
    ].join("\n\n");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You improve voice agent system prompts for Indian users (multilingual, respectful). Output a concise bullet list of suggested edits, then a revised prompt block.",
        },
        {
          role: "user",
          content: `Current prompt:\n${input.currentPrompt}\n\nSample transcripts:\n${joined}`,
        },
      ],
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    return `Prompt optimization failed: ${res.status}`;
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "No suggestion returned.";
}
