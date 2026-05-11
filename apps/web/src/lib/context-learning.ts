import { OpenAI } from "openai";

export async function extractCustomerContext(transcript: string, currentContext: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return currentContext;

  const openai = new OpenAI({ apiKey });
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI data extractor. Review the call transcript and update the customer's context data.
          Current Context: ${JSON.stringify(currentContext)}

          Extract and merge new information such as:
          - Preferences (e.g., preferred contact time, language, products)
          - Recent orders or items discussed
          - Active deals or status
          - Concerns or complaints

          Return the updated full context as a flat JSON object.`
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" }
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (e) {
    console.error("Failed to extract context:", e);
    return currentContext;
  }
}
