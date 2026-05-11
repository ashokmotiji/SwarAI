import { ReadmePreviewTopBar } from "@/components/readme-preview/readme-preview-top-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReadmePreviewDashboardPage() {
  return (
    <>
      <ReadmePreviewTopBar title="Welcome, Priya" />
      <div className="space-y-8 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Calls (all time)</CardDescription>
              <CardTitle className="text-3xl">128</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Agents</CardDescription>
              <CardTitle className="text-3xl">4</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Quick action</CardDescription>
              <CardTitle className="text-lg">Test voice</CardTitle>
            </CardHeader>
            <CardContent>
              <Button type="button">Open simulator</Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recent calls</CardTitle>
            <CardDescription>Latest sessions across web, phone, and embed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {[
                { id: "a1b2c3d4", channel: "web", status: "completed" },
                { id: "e5f67890", channel: "phone", status: "active" },
                { id: "11223344", channel: "embed", status: "completed" },
              ].map((c) => (
                <li key={c.id} className="flex justify-between py-3">
                  <span className="font-mono text-xs text-muted-foreground">{c.id}…</span>
                  <span>{c.channel}</span>
                  <span className="text-muted-foreground">{c.status}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
