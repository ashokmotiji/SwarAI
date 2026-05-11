import { OpenAI } from "openai";

export async function generatePerformanceScorecard(transcript: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert sales coach. Analyze the following call transcript and provide a performance scorecard in JSON format.
          The JSON should have:
          {
            "overall_score": number (0-10),
            "objection_handling_score": number (0-10),
            "tone_score": number (0-10),
            "product_knowledge_score": number (0-10),
            "strengths": string[],
            "areas_for_improvement": string[],
            "coaching_suggestions": string
          }`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Failed to generate scorecard:", error);
    return null;
  }
}

export async function generateCallSummary(transcript: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return "Summary unavailable";

  const openai = new OpenAI({ apiKey });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Summarize the following call transcript in 2-3 concise sentences, focusing on the outcome and any follow-up actions."
        },
        {
          role: "user",
          content: transcript
        }
      ]
    });

    return response.choices[0].message.content || "Summary unavailable";
  } catch {
    return "Summary unavailable";
  }
}

export async function extractOrderValue(transcript: string): Promise<number> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return 0;

  const openai = new OpenAI({ apiKey });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Extract the total order value mentioned in the transcript. Return only the number (e.g. 500.50). If no order was placed, return 0."
        },
        {
          role: "user",
          content: transcript
        }
      ]
    });

    const content = response.choices[0].message.content || "0";
    const val = parseFloat(content.replace(/[^0-9.]/g, ""));
    return isNaN(val) ? 0 : val;
  } catch {
    return 0;
  }
}
