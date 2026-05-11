import { ReadmePreviewTopBar } from "@/components/readme-preview/readme-preview-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ReadmePreviewSettingsPage() {
  return (
    <>
      <ReadmePreviewTopBar title="Settings" />
      <div className="space-y-8 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Workspace plan</CardTitle>
            <CardDescription>Freemium defaults; upgrade when you connect billing providers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Current plan</span>
              <Badge>Pro</Badge>
            </div>
            <div className="space-y-2">
              <Label>Daily voice sessions (per org)</Label>
              <Input readOnly className="max-w-xs" value="30" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment readiness</CardTitle>
            <CardDescription>Stripe, Razorpay, and PayU hooks — configure env and webhooks.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge className="border-emerald-500/50 bg-background text-emerald-700 dark:text-emerald-400">App URL</Badge>
            <Badge className="bg-background">Stripe checkout</Badge>
            <Badge className="border-amber-500/50 bg-background text-amber-800 dark:text-amber-400">Razorpay API</Badge>
            <Badge className="bg-background">PayU hosted</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Org webhooks, CRM, and platform status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Call completed webhook URL</Label>
              <Input readOnly value="https://api.example.com/hooks/swarsales-call" />
            </div>
            <div className="space-y-2">
              <Label>Webhook signing secret</Label>
              <Input readOnly type="password" value="••••••••••••" />
            </div>
            <Button type="button" size="sm">
              Save settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Razorpay activity</CardTitle>
            <CardDescription>Recent webhook events (idempotent store).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              <li className="flex justify-between py-2">
                <span className="font-mono text-xs">pay_9xK2…</span>
                <span className="text-muted-foreground">payment.captured</span>
              </li>
              <li className="flex justify-between py-2">
                <span className="font-mono text-xs">pay_3mN1…</span>
                <span className="text-muted-foreground">order.paid</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
