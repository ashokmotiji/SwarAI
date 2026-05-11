<div align="center">

# SwarAI

### Open-core voice AI platform for multilingual agents

**Next.js 15** · **LiveKit** · **Supabase** · **Sarvam-ready worker** · **Telephony & billing hooks**

![MIT License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)
![Next.js 15](https://img.shields.io/badge/Next.js_15-000000?logo=next.js&logoColor=white&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=for-the-badge)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white&style=for-the-badge)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white&style=for-the-badge)
![LiveKit](https://img.shields.io/badge/LiveKit-00AEEF?logo=livekit&logoColor=white&style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white&style=for-the-badge)

[**Quick start**](#quick-start-development) · [**Contributing**](./CONTRIBUTING.md) · [**Security**](./SECURITY.md) · [**Code of Conduct**](./CODE_OF_CONDUCT.md)

</div>

---

## Open core & licensing

**The code in this repository is open source under the [MIT License](./LICENSE)** — Copyright © 2025 Ashok Moti Ji & SwarAI contributors.

**Open-core model:** the **core platform** in this monorepo is MIT-licensed. Certain **commercial** features, managed services, or enterprise distributions may be offered under **separate terms**; see the [“Open core and other offerings”](./LICENSE#open-core-and-other-offerings) section in `LICENSE`. If a file or package specifies another license, that text applies to that component.

---

## Quick demo & live preview

> **Placeholder:** A hosted **live demo** and **video walkthrough** will be linked here.  
> For now, run SwarAI locally with [Quick start](#quick-start-development) or bring it up with [Docker Compose](#docker-compose-self-host-sketch).

**Planned:** public sandbox · recorded tour · embeddable widget example for docs.

---

## Screenshots

Replace these placeholders with real assets under [`screenshots/`](./screenshots/) when you have them.

| Dashboard | Call simulator |
|:---:|:---:|
| ![Dashboard](https://placehold.co/640x400/0A2540/00D4FF?text=SwarAI+Dashboard&font=roboto) | ![Call simulator](https://placehold.co/640x400/0A2540/00D4FF?text=Live+Call+Simulator&font=roboto) |
| **Agent editor** | **Settings & billing** |
| ![Agent editor](https://placehold.co/640x400/0A2540/00D4FF?text=Agent+Editor&font=roboto) | ![Settings](https://placehold.co/640x400/0A2540/00D4FF?text=Settings+%26+Billing&font=roboto) |

**Local paths (optional):** `![Dashboard](./screenshots/dashboard.png)` · `![Simulator](./screenshots/simulator.png)` · `![Agent editor](./screenshots/agent-editor.png)` · `![Settings](./screenshots/settings.png)`

---

## Roadmap

- **Quality & ops:** Expand automated tests, CI coverage, and runbooks for telephony / LiveKit SIP.
- **Developer experience:** CLI bootstrap, more examples, and Kubernetes / Helm references alongside Docker Compose.
- **Channels & speech:** Deeper docs for WhatsApp, inbound/outbound PSTN, and additional provider stacks.
- **Community:** Public demo environment, discussion hub, and contributor recognition.

## Monorepo layout

| Path | Purpose |
|------|---------|
| `apps/web` | Product UI, API routes, webhooks |
| `apps/voice-worker` | LiveKit agent worker (Sarvam plugins) |
| `packages/core` | Shared Zod schemas & types |
| `packages/agent-builder` | Flow graph model for the visual builder |
| `supabase/migrations` | Postgres schema, RLS, pgvector |
| `docker/docker-compose.yml` | Redis + web + worker |

## Prerequisites

- Node 20+, `pnpm` 9+
- Python 3.11+ (for the worker)
- Supabase project (India/Mumbai region recommended for DPDP alignment)
- Clerk application
- LiveKit Cloud project (or self-hosted LiveKit — advanced)
- Sarvam API key

## Quick start (development)

1. Copy envs: `cp .env.example .env` and fill values. For the web app, either keep a single root `.env` and run `ln -sf ../../.env apps/web/.env` once (Next.js reads `apps/web/.env`), or copy the file there.
2. **Supabase**: follow **`supabase/SETUP.md`**. Fast path: paste **`supabase/apply_all_migrations_one_shot.sql`** into the SQL Editor and run once, then run **`supabase/verify_schema.sql`**. Or use CLI: `pnpm run supabase:login` → `supabase:link` → `supabase:push`.
3. **Clerk ↔ Supabase**: create a JWT template named `supabase` and enable third-party auth in Supabase ([docs](https://clerk.com/docs/integrations/databases/supabase)).
4. Install: `pnpm install`
5. Web: `pnpm --filter @swarai/web dev`
6. Worker (separate shell):

```bash
cd apps/voice-worker
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
export LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
export SARVAM_API_KEY=...
export SWARAI_APP_URL=http://localhost:3000
export SWARAI_INTERNAL_WEBHOOK_SECRET=... # same as in .env
python -m swarai_agent dev
```

7. Open the app, sign up, then **Dashboard → Call simulator**. Ensure the worker is running so the agent joins the room.

## Docker Compose (self-host sketch)

From repo root:

```bash
cp .env.example .env
docker compose -f docker/docker-compose.yml up --build
```

Use `SWARAI_APP_URL=http://web:3000` for the worker in Compose so shutdown transcripts can POST to the internal service. You still need real LiveKit + Sarvam + Supabase + Clerk credentials in `.env`.

## Recommended platform strategy (research-backed)

SwarAI optimizes for **one realtime transport (LiveKit)** and **swappable speech/LLM providers** rather than a single vendor’s end-to-end speech API. That pattern scores best for a product that must span **web, embed, SIP phone, and future WhatsApp** while staying strong in **Indian languages** and still competitive globally.

| Goal | Recommendation |
|------|----------------|
| Cross-channel audio (web + embed + phone) | **LiveKit** rooms + SIP bridge (Twilio/Exotel) — same agent worker, same session model. |
| India / Hinglish / regional quality | **Sarvam** Saaras v3 + Bulbul v3 + Sarvam-m as **default** (`provider_stack: sarvam`). |
| Global enterprise / voice branding | **`deepgram_elevenlabs_openai`** on the worker — multilingual STT, chosen TTS voice, your LLM. |
| Product-wide analytics & CRM | **Unified `calls` rows + org webhook** on completion — channel-agnostic, not tied to one STT vendor. |
| WhatsApp | **Meta Cloud API** as its own ingress; unify downstream with the same DB + webhooks (audio pipeline differs by design). |

Single-stack **speech-to-speech** products can win on **English-only** simplicity and latency, but they trade away **provider choice, language coverage, and data/control flexibility** — so they are a deliberate *optional* path, not SwarAI’s default.

## Architecture (short)

- Browser obtains a short-lived **LiveKit token** from `POST /api/livekit/token` after Clerk auth.
- The API creates a `calls` row and a LiveKit **room with JSON metadata** (prompt, languages, `callId`, voice).
- The **Python worker** joins jobs, reads room metadata, runs **Sarvam STT/TTS/LLM**, and on shutdown POSTs chat history to `POST /api/internal/call-transcript` (protected by `SWARAI_INTERNAL_WEBHOOK_SECRET`).
- Every **10 completed calls** per agent triggers a **prompt suggestion** row (OpenAI optional).
- **Redis**-backed rate limits on hot routes when `REDIS_URL` is set; **org webhook** POST on call completion plus optional **second CRM URL** (Settings or `SWARAI_CRM_WEBHOOK_SECRET`); **WhatsApp** verify uses Meta `x-hub-signature-256` when `WHATSAPP_APP_SECRET` is set; async AI replies need `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `OPENAI_API_KEY`.
- **Visual flow builder** (`/dashboard/agents/[id]/flow`) compiles into the agent prompt; **mid-call language** via `POST /api/livekit/room-language` + worker `room_metadata_changed`.
- **Voice worker** supports `openai` and `deepgram_elevenlabs_openai` stacks plus Sarvam defaults; function tools and language switching are built in.
- **RAG**: `search_knowledge` tool → `POST /api/internal/knowledge-search` (optional **Pinecone** when `PINECONE_HOST` + `PINECONE_API_KEY` are set, namespace = agent id; otherwise pgvector + OpenAI embeddings; keyword fallback if no key).
- **Weather / maps** tools in the worker (Open-Meteo + Google Maps search links).
- **Freemium**: new orgs default to `plan: free`; daily voice session quota when `REDIS_URL` is set (`SWARAI_DEFAULT_FREE_VOICE_SESSIONS_PER_DAY`, overridable in Settings).
- **WhatsApp** webhook persists payloads to `whatsapp_inbound` (bridge to voice is org-specific).
- **Sentiment**: optional OpenAI scoring on call completion when `OPENAI_API_KEY` is set.
- **Docker**: optional self-hosted LiveKit — `docker compose -f docker/docker-compose.yml --profile with-livekit up`.
- **Google Calendar**: service account JSON (`GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON`) + `GOOGLE_CALENDAR_ID`; voice agent tool `book_google_calendar_event` calls `POST /api/internal/calendar-event` with `SWARAI_INTERNAL_WEBHOOK_SECRET`.
- **Voice clone**: upload sample on an agent → optional **ElevenLabs IVC** when `ELEVENLABS_API_KEY` is set; copy `elevenlabsVoiceId` from the API response into the agent voice field and use stack `deepgram_elevenlabs_openai`.
- **Warm transfer (Twilio)**: store `twilioCallSid` on the `calls` row (outbound create does this), then `POST /api/telephony/warm-transfer` with `targetE164`; Twilio fetches TwiML from `/api/webhooks/twilio/warm-transfer-twiml`.
- **Razorpay webhooks**: `POST /api/webhooks/razorpay` verifies `X-Razorpay-Signature` with `RAZORPAY_WEBHOOK_SECRET`, stores idempotent rows in `razorpay_webhook_events`, and updates org `settings.plan` / `settings.razorpay` when payloads include `swarai_org_id` (added automatically on dashboard-created orders). Optional `SWARAI_RAZORPAY_PRO_MIN_PAISE` upgrades on large captures.
- **Stripe webhooks**: `POST /api/webhooks/stripe` with `STRIPE_WEBHOOK_SECRET` — on successful subscription checkout sets `plan: pro`; on subscription deletion sets `plan: free`. Checkout sessions carry `swarai_org_id` in metadata.
- **PayU (India)**: `POST /api/billing/payu/init` builds a signed request; PayU redirects the browser to `POST /api/billing/payu/callback` (public route, hash-verified). Successful **Pro** payments set `settings.plan` to `pro`. Configure `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_MODE`, and `NEXT_PUBLIC_APP_URL` (surl/furl).
- **Pinecone**: knowledge ingestion (`POST /api/ingestion/knowledge`) upserts embeddings into namespace = **agent id** when `PINECONE_HOST` + `PINECONE_API_KEY` are set (1536-dim index to match `text-embedding-3-small`).
- **Health**: `GET /api/health` returns Redis + Supabase checks and a **`payments`** summary (which providers are configured).
- **Dashboard**: **Settings → Payment readiness** (from `/api/billing/readiness`); **Compliance** + **Legal drafts** (privacy/terms templates, subprocessors, data inventory — not a substitute for counsel).

## Compliance note

The schema includes India-first defaults (`data_region`, audit-friendly tables). Use **Dashboard → Compliance / Legal drafts** as an internal starting point. Production DPDP compliance still requires your **hosting region**, **DPA**, **subprocessor list**, **retention**, and **operational** controls — finalize with qualified counsel.

## License & attribution

SwarAI is released under the **[MIT License](./LICENSE)**. By contributing, you agree your contributions are licensed under the same terms — see [CONTRIBUTING.md](./CONTRIBUTING.md).

Commercial or separately licensed offerings, if any, are described in [`LICENSE`](./LICENSE#open-core-and-other-offerings).
