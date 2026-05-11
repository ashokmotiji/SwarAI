import { ReadmePreviewTopBar } from "@/components/readme-preview/readme-preview-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function ReadmePreviewSimulatorPage() {
  return (
    <>
      <ReadmePreviewTopBar title="Call simulator" />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Browser voice session</CardTitle>
            <CardDescription>Uses your microphone. Ensure the LiveKit worker is running.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Agent</Label>
              <div className="flex h-10 w-full max-w-md items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                Customer support (HI)
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button">Start session</Button>
              <Button type="button" variant="outline">
                Disconnect
              </Button>
            </div>
            <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-gradient-to-br from-slate-950 via-slate-900 to-primary/20">
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                <p className="text-sm font-medium text-white/90">LiveKit room · swarai-demo</p>
                <p className="text-xs text-white/60">Microphone connected · Agent speaking…</p>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Mute</span>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">Speaker</span>
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Mid-call language (LiveKit room metadata)</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 w-[160px] items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
                  Hindi
                </div>
                <Button type="button" size="sm" variant="secondary">
                  Apply
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
