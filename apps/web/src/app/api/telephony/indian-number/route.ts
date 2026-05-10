import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensurePersonalOrg } from "@/lib/org";

const BodySchema = z.object({
  city: z.string().min(2).max(80).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await ensurePersonalOrg(userId, (await currentUser())?.primaryEmailAddress?.emailAddress ?? null);

  const sid = process.env.EXOTEL_SID;
  const key = process.env.EXOTEL_API_KEY;
  const token = process.env.EXOTEL_TOKEN;

  if (!sid || !key || !token) {
    return NextResponse.json({
      simulated: true,
      message: "Exotel credentials not set — returning a simulated Indian virtual number.",
      number: "+9198" + String(Math.floor(1e7 + Math.random() * 9e7)),
      city: body.city ?? "Mumbai",
      provider: "exotel-sim",
    });
  }

  return NextResponse.json({
    simulated: false,
    message:
      "Number purchase APIs vary by account — use Exotel dashboard to buy DIDs. Keys detected: provisioning checklist unlocked.",
    number: null,
    provider: "exotel",
  });
}
