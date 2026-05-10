import Link from "next/link";
import { TopBar } from "@/components/dashboard/top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const checklist = [
  {
    title: "Data residency & processors",
    body: "Confirm Supabase region, LiveKit region, and third-party DPAs (Clerk, OpenAI, ElevenLabs, Sarvam, Meta, Razorpay) match your policy.",
  },
  {
    title: "Retention & deletion",
    body: "Set `retention_days` / org policy for call transcripts, WhatsApp rows, and voice-clone storage; document customer deletion SOP.",
  },
  {
    title: "Consent & notices",
    body: "Publish privacy terms for voice recording, WhatsApp opt-in, and telephony recording where required.",
  },
  {
    title: "Security",
    body: "Rotate `SWARAI_INTERNAL_WEBHOOK_SECRET`, Razorpay/Stripe webhook secrets, and API keys on a schedule; restrict Supabase service role to server only.",
  },
  {
    title: "Access & audit",
    body: "Limit dashboard roles; use Supabase audit logs or external SIEM for production access reviews.",
  },
];

export default function CompliancePage() {
  return (
    <>
      <TopBar title="Compliance & DPDP" />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/dashboard/compliance/legal">Open legal drafts (privacy, terms, subprocessors)</Link>
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>India / DPDP-oriented checklist</CardTitle>
            <CardDescription>
              SwarAI stores schema defaults such as <code className="text-xs">data_region</code>. Legal compliance still
              depends on how you host, contract, and operate the product — use this as an internal pre-production review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ol className="list-decimal space-y-4 pl-5">
              {checklist.map((item) => (
                <li key={item.title} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{item.title}.</span> {item.body}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              This page is guidance only and not legal advice. Involve counsel before handling personal or sensitive
              categories of data at scale.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
