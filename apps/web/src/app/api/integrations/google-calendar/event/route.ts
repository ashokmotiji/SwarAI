import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePersonalOrg } from "@/lib/org";
import { insertCalendarEvent } from "@/lib/google-calendar-service";

const BodySchema = z.object({
  summary: z.string().min(1).max(500),
  description: z.string().max(4000).optional(),
  startIso: z.string().min(10),
  endIso: z.string().min(10),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await ensurePersonalOrg(userId, (await currentUser())?.primaryEmailAddress?.emailAddress ?? null);

  const ev = await insertCalendarEvent({
    summary: body.summary,
    description: body.description,
    startIso: body.startIso,
    endIso: body.endIso,
  });

  if (!ev) {
    return NextResponse.json(
      { error: "Calendar not configured — set GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON and share calendar with the service account email." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, ...ev });
}
