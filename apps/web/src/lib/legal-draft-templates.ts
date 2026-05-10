/** Generic drafts — replace [COMPANY], [CONTACT], jurisdictions, and review with counsel before publication. */

export const LEGAL_DISCLAIMER =
  "These drafts are starting points only, not legal advice. Adapt to your entity, product, and counsel review before use.";

export const PRIVACY_POLICY_TEMPLATE = `[COMPANY LEGAL NAME] — Privacy Policy (draft)

Last updated: [DATE]

1. Who we are
   Controller: [COMPANY] ([CONTACT EMAIL], [ADDRESS]).

2. What we process
   • Account: name, email, org/workspace identifiers (via Clerk).
   • Voice & calls: audio streams, transcripts, call metadata (via LiveKit and your configured STT/TTS/LLM providers).
   • Knowledge: text you upload for RAG; optional vectors in your database and/or Pinecone.
   • Messages: WhatsApp or other channel content you connect.
   • Payments: transaction references via your payment provider (Stripe / Razorpay / PayU); we do not store full card numbers.
   • Logs & security: limited technical logs for reliability and abuse prevention.

3. Purposes & lawful bases (India / DPDP framing — adjust with counsel)
   Service delivery, security, billing, analytics in aggregate, and legal compliance. Where consent is required (e.g. marketing, certain cookies), we will ask separately.

4. Sharing (sub-processors)
   See the in-app “Legal drafts → Subprocessors” table. We use providers for auth, database, realtime media, speech/AI, and payments only as needed to run the service you configure.

5. Retention
   Configurable per deployment. Define retention for transcripts, voice clones, and WhatsApp rows in your org policy and database settings.

6. Your rights
   Access, correction, deletion where applicable, grievance contact [CONTACT]. You may also have rights under applicable law (e.g. DPDP).

7. International transfers
   If you use providers outside India, document transfers and safeguards (SCCs, DPAs) as required.

8. Children
   Not directed at children; do not use for child-directed services without appropriate compliance.

9. Changes
   We will post updates here and, where required, notify you.

Contact: [CONTACT]`;

export const TERMS_OF_SERVICE_TEMPLATE = `[COMPANY LEGAL NAME] — Terms of Service (draft)

Last updated: [DATE]

1. Service
   SwarAI-style voice AI platform: dashboard, agents, telephony integrations, and optional channels you enable.

2. Accounts
   You are responsible for credentials and for activity under your workspace.

3. Acceptable use
   No unlawful, harmful, or rights-violating use; no attempt to bypass security or quotas; comply with telecom and recording laws where you operate.

4. Customer data & AI
   You control prompts, knowledge, and integrations. You represent you have rights to input data. Outputs may be inaccurate; you evaluate fitness for purpose.

5. Third-party services
   The product integrates third-party APIs you configure (speech, LLM, payments, messaging). Their terms apply to your use of those services.

6. Fees & trials
   As offered in your plan. Taxes may apply. Failure to pay may result in suspension where contractually permitted.

7. Confidentiality & IP
   Each party retains its IP. Feedback may be used to improve the service as permitted in your agreement.

8. Warranty disclaimer / liability cap
   Service “as is” to the maximum extent permitted. Liability caps and exclusions as in your commercial agreement with customers (customize).

9. Termination
   You may stop using the service; we may suspend for breach or risk. Sections that should survive termination (e.g. liability, confidentiality) survive.

10. Governing law
    [JURISDICTION]. Courts at [VENUE].

Contact: [CONTACT]`;

export const SUBPROCESSOR_ROWS: { name: string; role: string; notes: string }[] = [
  { name: "Clerk", role: "Authentication", notes: "User identity for dashboard; configure JWT for Supabase." },
  { name: "Supabase", role: "Database, Storage, pgvector", notes: "Primary data store; pick region (e.g. Mumbai)." },
  { name: "LiveKit", role: "Realtime media / rooms", notes: "Voice transport; optional SIP." },
  { name: "Sarvam / OpenAI / Deepgram / ElevenLabs", role: "Speech & language models", notes: "Per agent stack; customer BYO keys." },
  { name: "Stripe", role: "Card subscriptions (optional)", notes: "PCI scope per Stripe; webhooks for plan sync." },
  { name: "Razorpay", role: "India payments (optional)", notes: "Orders + webhooks when configured." },
  { name: "PayU", role: "India hosted checkout (optional)", notes: "Browser redirect + hash verification." },
  { name: "Meta (WhatsApp)", role: "Messaging (optional)", notes: "If Cloud API enabled." },
  { name: "Twilio / Exotel", role: "Telephony (optional)", notes: "SIP / PSTN as configured." },
  { name: "Google Calendar API", role: "Scheduling (optional)", notes: "Service account you provide." },
  { name: "Pinecone", role: "Vector search (optional)", notes: "If used for RAG namespace per agent." },
];

export const DATA_CATEGORIES: { category: string; examples: string; retentionHint: string }[] = [
  { category: "Identity & access", examples: "Email, name, Clerk user id", retentionHint: "Account lifetime + legal hold" },
  { category: "Voice & transcript", examples: "Audio, STT text, call logs", retentionHint: "Define in org policy / product settings" },
  { category: "Knowledge & RAG", examples: "Uploaded docs, chunks, embeddings", retentionHint: "Until deleted by admin" },
  { category: "Messaging", examples: "WhatsApp payloads", retentionHint: "Channel-specific policy" },
  { category: "Billing metadata", examples: "Customer ids, txn ids, plan", retentionHint: "Statutory / accounting rules" },
  { category: "Security logs", examples: "IP, timestamps, rate limits", retentionHint: "Short rolling window unless incident" },
];
