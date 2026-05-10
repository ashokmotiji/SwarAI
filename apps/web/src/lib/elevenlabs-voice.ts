/** Create an ElevenLabs custom voice from audio (IVC). Returns voice_id. */
export async function createElevenLabsVoiceFromSample(params: {
  name: string;
  audioBuffer: Buffer;
  filename: string;
}): Promise<{ voiceId: string } | null> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return null;

  const form = new FormData();
  form.append("name", params.name.slice(0, 80));
  form.append("files", new Blob([new Uint8Array(params.audioBuffer)]), params.filename);

  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": key },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { voice_id?: string };
  if (!data.voice_id) return null;
  return { voiceId: data.voice_id };
}
