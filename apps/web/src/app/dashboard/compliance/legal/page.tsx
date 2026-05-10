import Link from "next/link";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LEGAL_DISCLAIMER,
  PRIVACY_POLICY_TEMPLATE,
  TERMS_OF_SERVICE_TEMPLATE,
  SUBPROCESSOR_ROWS,
  DATA_CATEGORIES,
} from "@/lib/legal-draft-templates";

export default function LegalDraftsPage() {
  return (
    <>
      <TopBar title="Legal drafts" />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/compliance">← Compliance checklist</Link>
          </Button>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Important</CardTitle>
            <CardDescription>{LEGAL_DISCLAIMER}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Typical sub-processors</CardTitle>
            <CardDescription>Customize this table in your external privacy notice; enable only what you use.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 font-medium">Provider</th>
                  <th className="p-2 font-medium">Role</th>
                  <th className="p-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {SUBPROCESSOR_ROWS.map((r) => (
                  <tr key={r.name} className="border-b border-border/60">
                    <td className="p-2">{r.name}</td>
                    <td className="p-2 text-muted-foreground">{r.role}</td>
                    <td className="p-2 text-muted-foreground">{r.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal data inventory (starter)</CardTitle>
            <CardDescription>Map retention and legal basis in your RoPA / DPIA.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="p-2 font-medium">Category</th>
                  <th className="p-2 font-medium">Examples</th>
                  <th className="p-2 font-medium">Retention hint</th>
                </tr>
              </thead>
              <tbody>
                {DATA_CATEGORIES.map((r) => (
                  <tr key={r.category} className="border-b border-border/60">
                    <td className="p-2 font-medium">{r.category}</td>
                    <td className="p-2 text-muted-foreground">{r.examples}</td>
                    <td className="p-2 text-muted-foreground">{r.retentionHint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy policy (draft text)</CardTitle>
            <CardDescription>Copy to your site or policy tool; replace bracketed placeholders.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
              {PRIVACY_POLICY_TEMPLATE}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terms of service (draft text)</CardTitle>
            <CardDescription>B2B-oriented starter; align caps and law with your counsel.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed">
              {TERMS_OF_SERVICE_TEMPLATE}
            </pre>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
