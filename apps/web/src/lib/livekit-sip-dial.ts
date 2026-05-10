/**
 * SIP Request-URI Twilio/Exotel should dial so the PSTN leg lands in the right LiveKit room.
 *
 * Configure one of:
 * - LIVEKIT_SIP_DIAL_URI_TEMPLATE — e.g. sip:{room}@sip.yourdomain.com (literal {room} replaced)
 * - LIVEKIT_SIP_ROOM_HOST — host part only, e.g. sip.yourdomain.com → sip:{roomName}@sip.yourdomain.com
 * - LIVEKIT_SIP_URI — static trunk URI (backward compatible; room routing then depends on LiveKit SIP dispatch rules)
 */
export function buildLiveKitSipDialUri(roomName: string): string {
  const template = process.env.LIVEKIT_SIP_DIAL_URI_TEMPLATE?.trim();
  if (template?.includes("{room}")) {
    return template.split("{room}").join(roomName);
  }
  const host = process.env.LIVEKIT_SIP_ROOM_HOST?.trim();
  if (host) {
    const h = host.replace(/^sip:/, "").replace(/^\/\//, "");
    return `sip:${roomName}@${h}`;
  }
  const fallback = process.env.LIVEKIT_SIP_URI?.trim();
  if (!fallback) {
    throw new Error("Set LIVEKIT_SIP_URI or LIVEKIT_SIP_ROOM_HOST / LIVEKIT_SIP_DIAL_URI_TEMPLATE for telephony");
  }
  return fallback;
}
