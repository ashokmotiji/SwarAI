import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

export function getLiveKitConfig() {
  const host = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!host || !apiKey || !apiSecret) {
    throw new Error("Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET");
  }
  return { host, apiKey, apiSecret };
}

/** Browser WebSocket URL for LiveKit client. */
export function liveKitWsUrl(host: string) {
  const h = host.trim();
  if (h.startsWith("wss://") || h.startsWith("ws://")) return h;
  if (h.startsWith("https://")) return `wss://${h.slice("https://".length)}`;
  if (h.startsWith("http://")) return `ws://${h.slice("http://".length)}`;
  return h;
}

export async function ensureRoomWithMetadata(roomName: string, metadata: Record<string, unknown>) {
  const { host, apiKey, apiSecret } = getLiveKitConfig();
  const svc = new RoomServiceClient(host, apiKey, apiSecret);
  const meta = JSON.stringify(metadata);
  const rooms = await svc.listRooms([roomName]);
  if (rooms.length === 0) {
    await svc.createRoom({
      name: roomName,
      metadata: meta,
      emptyTimeout: 300,
      maxParticipants: 10,
    });
  } else {
    await svc.updateRoomMetadata(roomName, meta);
  }
}

/** Deep-merge JSON room metadata with a patch (mid-call language, etc.). */
export async function mergeRoomMetadata(roomName: string, patch: Record<string, unknown>) {
  const { host, apiKey, apiSecret } = getLiveKitConfig();
  const svc = new RoomServiceClient(host, apiKey, apiSecret);
  const rooms = await svc.listRooms([roomName]);
  if (rooms.length === 0) {
    throw new Error("Room not found");
  }
  let base: Record<string, unknown> = {};
  const raw = rooms[0].metadata;
  if (raw) {
    try {
      base = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  const next = { ...base, ...patch };
  await svc.updateRoomMetadata(roomName, JSON.stringify(next));
}

export async function mintParticipantToken(roomName: string, identity: string, name?: string) {
  const { apiKey, apiSecret } = getLiveKitConfig();
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name ?? identity,
    ttl: "15m",
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}
