import { ReadmePreviewTopBar } from "@/components/readme-preview/readme-preview-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function ReadmePreviewAgentEditorPage() {
  return (
    <>
      <ReadmePreviewTopBar title="Edit · Customer support (HI)" />
      <div className="max-w-3xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent</CardTitle>
            <CardDescription>Defaults target Sarvam Bulbul v3 + Saaras v3 via the worker.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rp-name">Name</Label>
              <Input id="rp-name" readOnly value="Customer support (HI)" />
            </div>
            <div className="space-y-2">
              <Label>Indian context snippets</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm">
                  + DPDP note
                </Button>
                <Button type="button" variant="outline" size="sm">
                  + Hinglish
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rp-prompt">System prompt</Label>
              <Textarea
                id="rp-prompt"
                readOnly
                className="min-h-[140px] resize-none"
                value="You are SwarSales AI for Acme India. Greet in Hindi or English; keep answers short. Confirm bookings and offer escalation to a human when unsure."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Default language</Label>
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm">Hindi</div>
              </div>
              <div className="space-y-2">
                <Label>Voice (Sarvam)</Label>
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm">anushka</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">en</Badge>
              <Badge variant="secondary">hi</Badge>
              <Badge variant="secondary">auto</Badge>
            </div>
            <div className="rounded-lg border border-dashed p-4">
              <Label className="text-muted-foreground">Inbound phone number (E.164)</Label>
              <Input readOnly className="mt-2 max-w-md" value="+919876543210" />
              <p className="mt-2 text-xs text-muted-foreground">One agent per DID — Twilio / Exotel webhook routing.</p>
            </div>
            <div className="flex gap-2">
              <Button type="button">Save</Button>
              <Button type="button" variant="outline">
                Open flow builder
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
