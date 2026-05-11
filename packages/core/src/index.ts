import { z } from "zod";

export const INDIAN_LANGUAGES = [
  "hi",
  "ta",
  "te",
  "kn",
  "ml",
  "bn",
  "mr",
  "gu",
  "pa",
  "or",
  "en",
  "auto",
] as const;

export type IndianLanguage = (typeof INDIAN_LANGUAGES)[number];

const languageEnum = INDIAN_LANGUAGES as unknown as [IndianLanguage, ...IndianLanguage[]];

export const ProviderStackSchema = z.enum([
  "sarvam",
  "openai",
  "deepgram_elevenlabs_openai",
  "custom",
]);

export type ProviderStack = z.infer<typeof ProviderStackSchema>;

export const AgentConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  systemPrompt: z.string().min(1).max(32000),
  defaultLanguage: z.enum(languageEnum),
  supportedLanguages: z.array(z.enum(languageEnum)).min(1),
  voiceId: z.string().min(1),
  providerStack: ProviderStackSchema.default("sarvam"),
  hinglishFriendly: z.boolean().default(true),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const CallChannelSchema = z.enum(["web", "phone", "whatsapp", "embed"]);

export type CallChannel = z.infer<typeof CallChannelSchema>;

export const CreateRoomRequestSchema = z.object({
  agentId: z.string().uuid().optional(),
  displayName: z.string().max(120).optional(),
});

export type CreateRoomRequest = z.infer<typeof CreateRoomRequestSchema>;

export const LiveKitTokenResponseSchema = z.object({
  token: z.string(),
  url: z.string().url(),
  roomName: z.string(),
  identity: z.string(),
  callId: z.string().uuid().optional(),
});

export type LiveKitTokenResponse = z.infer<typeof LiveKitTokenResponseSchema>;

/** Open-core vs enterprise feature flags (env-driven in apps). */
export const LicenseTierSchema = z.enum(["community", "pro", "enterprise"]);

export type LicenseTier = z.infer<typeof LicenseTierSchema>;

export function getLicenseTierFromEnv(env: Record<string, string | undefined>): LicenseTier {
  const raw = env.SWARSALES_LICENSE_TIER;
  const parsed = LicenseTierSchema.safeParse(raw);
  return parsed.success ? parsed.data : "community";
}
