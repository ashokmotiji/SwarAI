import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STACK_RECOMMENDATIONS, UNIFIED_EVENTS_NOTE } from "@/lib/platform-strategy";
import Link from "next/link";

const links = [
  { href: "https://docs.livekit.io/agents/", label: "LiveKit Agents" },
  { href: "https://livekit.com/blog/real-time-voice-agents-vs-model-apis", label: "Why modular voice agents (LiveKit)" },
  { href: "https://docs.livekit.io/agents/integrations/stt/sarvam", label: "Sarvam STT (LiveKit)" },
  { href: "https://docs.livekit.io/agents/integrations/tts/sarvam", label: "Sarvam TTS (LiveKit)" },
  { href: "https://www.sarvam.ai/integrations/livekit", label: "Sarvam + LiveKit overview" },
  { href: "https://clerk.com/docs/integrations/databases/supabase", label: "Clerk ↔ Supabase" },
];

export default function HelpPage() {
  return (
    <>
      <TopBar title="Help & docs" />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Best-practice stacks (cross-platform)</CardTitle>
            <CardDescription>
              Defaults favor <strong>LiveKit</strong> for one audio transport everywhere and <strong>Sarvam</strong> for Indian
              speech; other stacks are per-agent overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">{UNIFIED_EVENTS_NOTE}</p>
            <ul className="space-y-4">
              {STACK_RECOMMENDATIONS.map((s) => (
                <li key={s.stackId} className="rounded-lg border border-border/80 bg-muted/30 p-3">
                  <p className="font-medium">
                    {s.title}{" "}
                    <span className="text-xs font-normal text-muted-foreground">({s.stackId})</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-medium text-foreground">Best for:</span> {s.bestFor}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    <span className="font-medium text-foreground">Channels:</span> {s.channels}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In-app guidance</CardTitle>
            <CardDescription>Primary integration paths for SwarSales AI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Create a Supabase project (prefer Mumbai) and run `supabase/migrations` (including Razorpay audit table if
                you use billing webhooks).
              </li>
              <li>Configure Clerk with a `supabase` JWT template; paste JWKS into Supabase third-party auth.</li>
              <li>Create LiveKit keys and set LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET.</li>
              <li>Add SARVAM_API_KEY to the Python worker environment.</li>
              <li>
                Telephony: set <code className="text-xs">LIVEKIT_SIP_URI</code> and optional{" "}
                <code className="text-xs">LIVEKIT_SIP_ROOM_HOST</code> /{" "}
                <code className="text-xs">LIVEKIT_SIP_DIAL_URI_TEMPLATE</code> for per-call rooms. Point Twilio or Exotel
                voice URLs to <code className="text-xs">/api/webhooks/twilio/voice</code> or{" "}
                <code className="text-xs">/api/webhooks/exotel/voice</code> without a <code className="text-xs">room</code>{" "}
                query for inbound. On each agent, set <strong>Inbound phone number (E.164)</strong> to the DID for
                one-agent-per-number routing.
              </li>
              <li>Run `pnpm dev` for the web app and `swarsales-agent dev` for the worker.</li>
              <li>
                Review <Link href="/dashboard/compliance">Compliance &amp; DPDP</Link> before production data processing.
              </li>
              <li>
                India payments: Razorpay (API + webhook) or PayU hosted checkout (Settings → Billing); set PayU key/salt and{" "}
                <code className="text-xs">NEXT_PUBLIC_APP_URL</code> for return URLs.
              </li>
            </ol>
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.href}>
                  <Link className="text-primary underline-offset-4 hover:underline" href={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
