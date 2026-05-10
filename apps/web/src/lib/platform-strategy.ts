/**
 * Research-backed defaults for SwarAI (2026): maximize cross-platform reach without vendor lock-in.
 *
 * - LiveKit: one WebRTC/SFU path for browser, embed, and SIP-bridged phone — avoids rebuilding
 *   transport per channel (contrast: stitching separate Twilio Media Streams + custom web clients).
 * - Sarvam (Saaras v3 / Bulbul v3): strongest fit for Indian languages, code-mix, telephony-tuned STT,
 *   official LiveKit plugins — default for India-first product thesis.
 * - Modular STT/LLM/TTS (e.g. Deepgram + OpenAI + ElevenLabs): best global “control plane” when you
 *   need vendor choice, English-heavy latency tuning, or non-Sarvam voices — keep behind agent `providerStack`.
 * - Single-vendor speech-to-speech (e.g. OpenAI Realtime + Twilio): excellent for English-only demos
 *   and minimum moving parts, but weak for multi-language, residency, and long-term negotiation — not the default here.
 * - WhatsApp: Meta Cloud API is a separate ingress; unify in product via `calls` + org webhooks, not one audio pipe.
 */
export const DEFAULT_PROVIDER_STACK = "sarvam" as const;

export type StackRecommendation = {
  stackId: string;
  title: string;
  bestFor: string;
  channels: string;
  notes: string;
};

export const STACK_RECOMMENDATIONS: StackRecommendation[] = [
  {
    stackId: "sarvam",
    title: "Sarvam + LiveKit (default)",
    bestFor: "India-first production: 10+ languages, Hinglish, accents, telephony, DPDP-friendly hosting choices",
    channels: "Web, embed, SIP phone (Twilio/Exotel → LiveKit)",
    notes: "Lowest integration risk for Indian speech; swap stack per agent if needed.",
  },
  {
    stackId: "deepgram_elevenlabs_openai",
    title: "Deepgram + ElevenLabs + OpenAI",
    bestFor: "Global enterprises, English-heavy mixed locales, custom celebrity voices",
    channels: "Same LiveKit rooms — only the worker pipeline changes",
    notes: "Use multilingual STT + your preferred TTS voice IDs; tune LLM separately.",
  },
  {
    stackId: "openai",
    title: "OpenAI end-to-end (worker)",
    bestFor: "Fast path when Sarvam keys are absent or A/B testing OpenAI STT/TTS/LLM",
    channels: "Web, embed, SIP via LiveKit",
    notes: "Convenient but watch language coverage vs Sarvam on Indian audio.",
  },
];

export const UNIFIED_EVENTS_NOTE =
  "Use org ‘call completed’ webhooks + Supabase `calls` as the cross-platform brain: CRM, analytics, and automations stay consistent whether the user talked on web, phone, or (future) WhatsApp voice.";
