/** Lightweight sentiment heuristic for Indian CS contexts (MVP; replace with model scoring in production). */
export function scoreSentimentFromText(text: string): { label: string; score: number } {
  const t = text.toLowerCase();
  const neg =
    /\b(not happy|unhappy|frustrat|angry|gussa|problem|issue|refund|complaint|worst|delay|fraud)\b/.test(t);
  const pos =
    /\b(thank|thanks|dhanyavaad|shukriya|great|good|awesome|helpful|solved|perfect)\b/.test(t);
  if (neg && !pos) return { label: "negative", score: -0.65 };
  if (pos && !neg) return { label: "positive", score: 0.72 };
  if (pos && neg) return { label: "mixed", score: 0.05 };
  return { label: "neutral", score: 0.1 };
}

export function festivalGreetingHint(): string {
  const month = new Date().getMonth() + 1;
  if (month === 10 || month === 11) {
    return "Seasonal context: many users celebrate Diwali around this time — offer a warm, optional festive greeting only if the user sounds social (not for urgent support).";
  }
  if (month === 3) {
    return "Seasonal context: Holi may be relevant — stay respectful and professional unless the user initiates festive small talk.";
  }
  return "";
}
