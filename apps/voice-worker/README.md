# SwarSales AI voice worker

Python [LiveKit Agents](https://docs.livekit.io/agents/) worker:

- **sarvam** (default): Saaras v3 STT, Bulbul v3 TTS, `sarvam-m` LLM.
- **openai**: OpenAI STT/TTS/LLM (`OPENAI_API_KEY`, optional `SWARSALES_OPENAI_LLM_MODEL`).
- **deepgram_elevenlabs_openai**: Deepgram `nova-3` + language detection, ElevenLabs TTS (`ELEVENLABS_API_KEY`, `voiceId` = ElevenLabs voice id), OpenAI LLM.
- **custom**: uses OpenAI if `OPENAI_API_KEY` is set, otherwise Sarvam.

Includes function tools (weather stub, UPI guidance, calendar stub, human handoff, `switch_spoken_language`) and **LiveKit `room_metadata_changed`** handling for mid-call language switches from the dashboard.

## Run locally

```bash
cd apps/voice-worker
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
export LIVEKIT_URL=...
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...
export SARVAM_API_KEY=...
# Optional stacks:
# export OPENAI_API_KEY=...
# export DEEPGRAM_API_KEY=...
# export ELEVENLABS_API_KEY=...
export SWARSALES_APP_URL=http://localhost:3000   # Next.js URL reachable from this process
export SWARSALES_INTERNAL_WEBHOOK_SECRET=...    # must match web app
python -m swarsales_agent dev
```

Room metadata is set by the web app when creating LiveKit rooms (system prompt, languages, `callId`, etc.).

## Docker

See root `docker-compose.yml` — the worker service installs this package and runs `python -m swarsales_agent start` (production-style).
