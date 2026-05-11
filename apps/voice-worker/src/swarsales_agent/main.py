"""LiveKit Agents entrypoint: Sarvam default + OpenAI / Deepgram+ElevenLabs stacks, tools, RAG, mid-call language."""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, replace
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("swarsales.agent")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

LANG_TO_TTS: dict[str, str] = {
    "hi": "hi-IN",
    "ta": "ta-IN",
    "te": "te-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "bn": "bn-IN",
    "mr": "mr-IN",
    "gu": "gu-IN",
    "pa": "pa-IN",
    "or": "od-IN",
    "en": "en-IN",
    "auto": "en-IN",
}

OPENAI_STT_LANG: dict[str, str] = {
    "hi": "hi",
    "ta": "ta",
    "te": "te",
    "kn": "kn",
    "ml": "ml",
    "bn": "bn",
    "mr": "mr",
    "gu": "gu",
    "pa": "pa",
    "or": "or",
    "en": "en",
    "auto": "en",
}


@dataclass
class RoomAgentConfig:
    system_prompt: str
    speaker: str
    default_language: str
    languages: list[str]
    provider_stack: str = "sarvam"
    hinglish_friendly: bool = True
    call_id: str | None = None
    agent_id: str | None = None
    telephony_config: dict[str, Any] | None = None


def _parse_metadata(metadata: str | None) -> RoomAgentConfig:
    if not metadata:
        return RoomAgentConfig(
            system_prompt=os.getenv(
                "SWARSALES_DEFAULT_SYSTEM_PROMPT",
                "You are SwarSales AI, a helpful voice assistant optimized for Indian users. "
                "Be concise, polite, and respectful. Support Hinglish when users mix Hindi and English.",
            ),
            speaker=os.getenv("SARVAM_DEFAULT_SPEAKER", "anushka"),
            default_language="en",
            languages=["en", "hi", "auto"],
            telephony_config={},
        )
    try:
        data: dict[str, Any] = json.loads(metadata)
    except json.JSONDecodeError:
        logger.warning("Invalid room metadata JSON; using defaults")
        return _parse_metadata(None)

    langs = data.get("supportedLanguages") or data.get("languages") or ["en", "auto"]
    if not isinstance(langs, list):
        langs = ["en", "auto"]
    raw_lang = str(data.get("defaultLanguage") or data.get("default_language") or "en")
    speaker = str(
        data.get("voiceId") or data.get("voice_id") or data.get("speaker") or "anushka"
    )
    call_id = data.get("callId") or data.get("call_id")
    call_id_str = str(call_id) if call_id else None
    agent_raw = data.get("agentId") or data.get("agent_id")
    agent_id_str = str(agent_raw) if agent_raw else None
    tel = data.get("telephonyConfig") or data.get("telephony_config") or {}
    if not isinstance(tel, dict):
        tel = {}
    return RoomAgentConfig(
        system_prompt=str(
            data.get("systemPrompt")
            or data.get("system_prompt")
            or _parse_metadata(None).system_prompt
        ),
        speaker=speaker,
        default_language=raw_lang,
        languages=[str(x) for x in langs],
        provider_stack=str(data.get("providerStack") or "sarvam"),
        hinglish_friendly=bool(data.get("hinglishFriendly", True)),
        call_id=call_id_str,
        agent_id=agent_id_str,
        telephony_config=tel,
    )


def _tts_target_language(default_language: str) -> str:
    key = default_language.lower().split("-")[0]
    return LANG_TO_TTS.get(key, "en-IN")


def _openai_stt_lang(default_language: str) -> str:
    key = default_language.lower().split("-")[0]
    return OPENAI_STT_LANG.get(key, "en")


def _final_instructions(cfg: RoomAgentConfig) -> str:
    p = cfg.system_prompt
    if cfg.hinglish_friendly and "hinglish" not in p.lower():
        p += (
            "\n\nUsers may code-mix Hindi and English (Hinglish). "
            "Respond in the same language style they use unless they ask otherwise."
        )
    vc = (cfg.telephony_config or {}).get("voiceClone")
    if isinstance(vc, dict) and vc.get("storagePath"):
        p += (
            "\n\nNote: a custom voice sample is on file for this agent; "
            "keep replies clear and natural until the custom voice is bound in Sarvam/ElevenLabs."
        )
    if cfg.agent_id:
        p += (
            "\n\nWhen the user asks factual questions about products, policies, FAQs, or uploaded documents, "
            "call search_knowledge with a short query before answering from memory."
        )
    return p


def build_stt_llm_tts(cfg: RoomAgentConfig):  # noqa: PLR0911
    """Return (stt, llm, tts) for LiveKit Agent."""
    stack = (cfg.provider_stack or "sarvam").lower()
    if stack == "custom":
        stack = "openai" if os.getenv("OPENAI_API_KEY") else "sarvam"
    lang = cfg.default_language
    speaker = cfg.speaker

    if stack == "openai":
        from livekit.plugins import openai

        return (
            openai.STT(language=_openai_stt_lang(lang), model="gpt-4o-mini-transcribe"),
            openai.LLM(model=os.getenv("SWARSALES_OPENAI_LLM_MODEL", "gpt-4o-mini")),
            openai.TTS(model="gpt-4o-mini-tts", voice=speaker if len(speaker) < 40 else "alloy"),
        )

    if stack in ("deepgram_elevenlabs_openai", "deepgram-elevenlabs-openai"):
        from livekit.plugins import deepgram, elevenlabs, openai

        return (
            deepgram.STT(model="nova-3", language="multi", detect_language=True),
            openai.LLM(model=os.getenv("SWARSALES_OPENAI_LLM_MODEL", "gpt-4o-mini")),
            elevenlabs.TTS(voice_id=speaker, model="eleven_turbo_v2_5"),
        )

    from livekit.plugins import sarvam

    return (
        sarvam.STT(language=_tts_target_language(lang), model="saaras:v3"),
        sarvam.LLM(model="sarvam-m"),  # type: ignore[arg-type]
        sarvam.TTS(
            target_language_code=_tts_target_language(lang),  # type: ignore[arg-type]
            model="bulbul:v3",
            speaker=speaker,  # type: ignore[arg-type]
        ),
    )


async def _post_transcript(call_id: str | None, room_name: str, history_dict: dict[str, Any]) -> None:
    base = os.getenv("SWARSALES_APP_URL", "").rstrip("/")
    secret = os.getenv("SWARSALES_INTERNAL_WEBHOOK_SECRET", "")
    if not base or not secret or not call_id:
        logger.info("Skip transcript POST (missing SWARSALES_APP_URL, secret, or call_id)")
        return
    url = f"{base}/api/internal/call-transcript"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(
                url,
                json={"callId": call_id, "roomName": room_name, "history": history_dict},
                headers={"x-swarsales-internal": secret},
            )
            r.raise_for_status()
    except Exception:
        logger.exception("Failed to POST transcript for call_id=%s", call_id)


async def _open_meteo_weather(city: str) -> str:
    q = city.strip()
    if not q:
        return "Please name a city."
    async with httpx.AsyncClient(timeout=10.0) as client:
        geo = await client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": q, "count": "1", "language": "en", "format": "json"},
        )
        if geo.status_code != 200:
            return f"Could not look up {q}."
        gdata = geo.json()
        results = gdata.get("results") or []
        if not results:
            return f"No coordinates found for {q}. Try a larger nearby city."
        lat = results[0]["latitude"]
        lon = results[0]["longitude"]
        name = results[0].get("name", q)
        fc = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
                "timezone": "Asia/Kolkata",
            },
        )
        if fc.status_code != 200:
            return f"Forecast unavailable for {name}."
        cur = fc.json().get("current", {})
        temp = cur.get("temperature_2m")
        hum = cur.get("relative_humidity_2m")
        wind = cur.get("wind_speed_10m")
        return (
            f"{name}: about {temp}°C now, humidity {hum}%, wind ~{wind} km/h (Open-Meteo). "
            "Mention this is live model data, not a substitute for emergency alerts."
        )


def run_cli() -> None:
    from livekit.agents import WorkerOptions, cli

    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))


async def entrypoint(ctx: Any) -> None:
    from livekit.agents import AutoSubscribe, JobContext
    from livekit.agents.voice import Agent, AgentSession
    from livekit.agents.llm import function_tool
    from livekit.plugins import silero

    if not isinstance(ctx, JobContext):
        raise TypeError("entrypoint expects JobContext")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    room = ctx.room
    md = getattr(room, "metadata", None) or None
    initial = _parse_metadata(md if isinstance(md, str) else None)

    cfg_state: dict[str, RoomAgentConfig] = {"cfg": initial}
    session_ref: dict[str, Any] = {}

    @function_tool
    async def search_knowledge(query: str) -> str:
        """Search the org's uploaded knowledge (RAG) for relevant snippets."""
        aid = cfg_state["cfg"].agent_id
        base = os.getenv("SWARSALES_APP_URL", "").rstrip("/")
        secret = os.getenv("SWARSALES_INTERNAL_WEBHOOK_SECRET", "")
        if not aid or not base or not secret:
            return "Knowledge search is not configured for this call."
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    f"{base}/api/internal/knowledge-search",
                    json={"agentId": aid, "query": query.strip()[:2000], "matchCount": 8},
                    headers={"x-swarsales-internal": secret},
                )
                r.raise_for_status()
                data = r.json()
                text = str(data.get("text") or "").strip()
                if not text:
                    return "No matching knowledge chunks found; answer carefully and offer a human follow-up."
                return text[:8000]
        except Exception:
            logger.exception("search_knowledge failed")
            return "Knowledge search failed temporarily; continue with general guidance."

    @function_tool
    async def get_weather_india(city: str) -> str:
        """Live weather for an Indian or global city using Open-Meteo (free tier)."""
        try:
            return await _open_meteo_weather(city)
        except Exception:
            logger.exception("weather tool failed")
            return "Weather lookup failed; try again with a clearer city name."

    @function_tool
    async def maps_link(place: str) -> str:
        """Return a Google Maps search URL for directions or a landmark (user opens on their phone)."""
        p = place.strip()[:200]
        if not p:
            return "Ask which place to find."
        from urllib.parse import quote

        return f"https://www.google.com/maps/search/?api=1&query={quote(p)}"

    @function_tool
    async def upi_collection_guidance(customer_intent: str) -> str:
        """Explain safe UPI / Razorpay collection steps for Indian payments."""
        return (
            "For UPI: share a verified VPA or Razorpay payment link only on official channels; "
            "never ask for PIN or OTP. Log intent: "
            + customer_intent[:200]
        )

    @function_tool
    async def book_google_calendar_event(title: str, start_iso: str, end_iso: str) -> str:
        """Create a real Google Calendar event. Use RFC3339 ISO datetimes in Asia/Kolkata (e.g. 2026-05-10T15:00:00+05:30)."""
        base = os.getenv("SWARSALES_APP_URL", "").rstrip("/")
        secret = os.getenv("SWARSALES_INTERNAL_WEBHOOK_SECRET", "")
        if not base or not secret:
            return "Calendar bridge not configured (SWARSALES_APP_URL / internal secret)."
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.post(
                    f"{base}/api/internal/calendar-event",
                    json={
                        "summary": title[:500],
                        "startIso": start_iso[:80],
                        "endIso": end_iso[:80],
                        "description": "Created by SwarSales AI voice agent.",
                    },
                    headers={"x-swarsales-internal": secret},
                )
                data = r.json() if r.content else {}
                if r.status_code == 200 and data.get("ok"):
                    link = data.get("htmlLink") or ""
                    return f"Event created. {link}".strip()
                return f"Calendar error: {data.get('error', r.text)[:300]}"
        except Exception:
            logger.exception("calendar tool failed")
            return "Calendar request failed."

    @function_tool
    async def get_customer_history(query: str) -> str:
        """Retrieve recent customer interactions, orders, and preferences from CRM context."""
        aid = cfg_state["cfg"].agent_id
        cid = cfg_state["cfg"].call_id
        base = os.getenv("SWARSALES_APP_URL", "").rstrip("/")
        secret = os.getenv("SWARSALES_INTERNAL_WEBHOOK_SECRET", "")
        if not cid or not base or not secret:
            return "Customer history is not available for this call session."

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # First get call info to find org_id and customer_phone
                # In production, we'd pass these in room metadata for speed.
                # For now, we use internal APIs.
                r = await client.post(
                    f"{base}/api/internal/customer-context",
                    json={"callId": cid},
                    headers={"x-swarsales-internal": secret},
                )
                if r.status_code != 200:
                    return "Could not retrieve customer context."
                data = r.json()
                ctx = data.get("context") or {}
                if not ctx:
                    return "No previous customer history found. Treat as a new customer."
                return f"Customer Context: {json.dumps(ctx)}"
        except Exception:
            logger.exception("get_customer_history failed")
            return "Interaction history temporarily unavailable."

    @function_tool
    async def send_whatsapp_fallback(message: str) -> str:
        """Send a follow-up WhatsApp message to the customer (e.g., quotes, links, confirmation)."""
        cid = cfg_state["cfg"].call_id
        base = os.getenv("SWARSALES_APP_URL", "").rstrip("/")
        secret = os.getenv("SWARSALES_INTERNAL_WEBHOOK_SECRET", "")
        if not cid or not base or not secret:
            return "WhatsApp fallback is not configured for this call."
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    f"{base}/api/internal/fallback-message",
                    json={"callId": cid, "message": message, "channel": "whatsapp"},
                    headers={"x-swarsales-internal": secret},
                )
                if r.status_code == 200:
                    return "WhatsApp message sent successfully."
                return f"Failed to send WhatsApp: {r.text[:200]}"
        except Exception:
            logger.exception("send_whatsapp_fallback failed")
            return "WhatsApp service temporarily unavailable."

    @function_tool
    async def request_human_handoff(reason: str) -> str:
        """Warm-transfer playbook when the user needs a human."""
        return (
            "I'm arranging a human teammate to join. Until then, share your phone number or stay on the line. "
            f"Reason noted: {reason[:180]}"
        )

    @function_tool
    async def switch_spoken_language(language_code: str) -> str:
        """Switch assistant language: hi, en, ta, te, kn, ml, bn, mr, gu, pa, or, auto."""
        code = language_code.lower().strip()[:12]
        cfg_state["cfg"] = replace(cfg_state["cfg"], default_language=code)
        sess = session_ref.get("s")
        if sess is not None:
            sess.update_agent(_fresh_agent())
        return f"Okay — continuing in {code}."

    tools = [
        search_knowledge,
        get_customer_history,
        send_whatsapp_fallback,
        get_weather_india,
        maps_link,
        upi_collection_guidance,
        book_google_calendar_event,
        request_human_handoff,
        switch_spoken_language,
    ]

    def _fresh_agent() -> Agent:
        cfg = cfg_state["cfg"]
        stt, llm, tts = build_stt_llm_tts(cfg)
        return Agent(
            instructions=_final_instructions(cfg),
            tools=tools,
            stt=stt,
            llm=llm,
            tts=tts,
        )

    def _on_room_metadata_changed(_old: str, new: str) -> None:
        try:
            cfg_state["cfg"] = _parse_metadata(new)
            sess = session_ref.get("s")
            if sess is None:
                return
            try:
                sess.update_agent(_fresh_agent())
            except RuntimeError:
                pass
        except Exception:
            logger.exception("room_metadata_changed handler failed")

    room.on("room_metadata_changed", _on_room_metadata_changed)

    vad = silero.VAD.load(
        min_speech_duration=0.1,
        min_silence_duration=0.3,
        padding_duration=0.1,
    )
    session = AgentSession(
        vad=vad,
        allow_interruptions=True,
        interrupt_speech_duration=0.5,
        interrupt_min_words=0,
    )
    session_ref["s"] = session

    async def _on_shutdown(_reason: str) -> None:
        try:
            hist = session.history
            d = hist.to_dict() if hasattr(hist, "to_dict") else {"items": []}
            await _post_transcript(cfg_state["cfg"].call_id, room.name, d)
        except Exception:
            logger.exception("Shutdown transcript export failed")

    ctx.add_shutdown_callback(_on_shutdown)

    logger.info(
        "SwarSales AI agent start room=%s call_id=%s agent_id=%s stack=%s",
        room.name,
        cfg_state["cfg"].call_id,
        cfg_state["cfg"].agent_id,
        cfg_state["cfg"].provider_stack,
    )

    await session.start(room=room, agent=_fresh_agent())
