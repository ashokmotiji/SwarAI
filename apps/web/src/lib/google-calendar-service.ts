import { google } from "googleapis";

type Creds = { client_email: string; private_key: string };

function parseServiceAccount(): Creds | null {
  const raw = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as Creds;
    if (!j.client_email || !j.private_key) return null;
    return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export async function insertCalendarEvent(params: {
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
}): Promise<{ htmlLink?: string; id?: string } | null> {
  const creds = parseServiceAccount();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  if (!creds) return null;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const cal = google.calendar({ version: "v3", auth });
  const res = await cal.events.insert({
    calendarId,
    requestBody: {
      summary: params.summary.slice(0, 500),
      description: params.description?.slice(0, 4000),
      start: { dateTime: params.startIso, timeZone: "Asia/Kolkata" },
      end: { dateTime: params.endIso, timeZone: "Asia/Kolkata" },
    },
  });
  return { htmlLink: res.data.htmlLink ?? undefined, id: res.data.id ?? undefined };
}
