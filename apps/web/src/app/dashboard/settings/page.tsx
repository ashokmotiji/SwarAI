"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PlatformStatus = {
  googleCalendar: boolean;
  pinecone: boolean;
  whatsappCloud: boolean;
  elevenlabs: boolean;
  stripeWebhookSecret: boolean;
  razorpayPayments: boolean;
  razorpayWebhookSecret: boolean;
  payu: boolean;
  openai: boolean;
  redis: boolean;
};

type BillingEventRow = {
  razorpay_event_id: string;
  event_type: string;
  summary: Record<string, unknown> | null;
  created_at: string;
};

type PaymentReadiness = {
  appUrl: boolean;
  anyChargePath: boolean;
  planSyncReady: boolean;
  stripe: { checkout: boolean; webhook: boolean };
  razorpay: { api: boolean; webhook: boolean };
  payu: { hostedCheckout: boolean };
};

export default function SettingsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [crmWebhookUrl, setCrmWebhookUrl] = useState("");
  const [crmWebhookSecret, setCrmWebhookSecret] = useState("");
  const [hubspotConfig, setHubspotConfig] = useState({ enabled: false, webhookUrl: "", webhookSecret: "" });
  const [salesforceConfig, setSalesforceConfig] = useState({ enabled: false, webhookUrl: "", webhookSecret: "" });
  const [zohoConfig, setZohoConfig] = useState({ enabled: false, webhookUrl: "", webhookSecret: "" });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [plan, setPlan] = useState<string>("free");
  const [maxSessions, setMaxSessions] = useState<string>("");
  const [platform, setPlatform] = useState<PlatformStatus | null>(null);
  const [billingEvents, setBillingEvents] = useState<BillingEventRow[] | null>(null);
  const [billingErr, setBillingErr] = useState<string | null>(null);
  const [proAmountPaise, setProAmountPaise] = useState(99900);
  const [payuDemoInr, setPayuDemoInr] = useState(100);
  const [payuProInr, setPayuProInr] = useState(999);
  const [payuMode, setPayuMode] = useState<"test" | "production">("test");
  const [payReady, setPayReady] = useState<PaymentReadiness | null>(null);
  const [appOrigin, setAppOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setAppOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const payu = q.get("payu");
    if (payu === "success") {
      const intent = q.get("intent");
      setMsg(
        intent === "pro"
          ? "PayU payment successful — workspace plan set to Pro (verify in Plan above)."
          : "PayU payment completed successfully.",
      );
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    } else if (payu === "failed") {
      setMsg(`PayU returned failed (status=${q.get("status") ?? "unknown"}).`);
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    } else if (payu === "error") {
      setMsg(`PayU callback error: ${q.get("reason") ?? "unknown"}.`);
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/org/settings");
      const j = await res.json();
      if (cancelled || !res.ok) return;
      setWebhookUrl(typeof j.callCompletedWebhookUrl === "string" ? j.callCompletedWebhookUrl : "");
      setCrmWebhookUrl(typeof j.crmWebhookUrl === "string" ? j.crmWebhookUrl : "");
      if (j.hubspotConfig) setHubspotConfig(j.hubspotConfig);
      if (j.salesforceConfig) setSalesforceConfig(j.salesforceConfig);
      if (j.zohoConfig) setZohoConfig(j.zohoConfig);
      if (typeof j.plan === "string") setPlan(j.plan);
      else if (j.plan === null) setPlan("legacy");
      setMaxSessions(j.maxVoiceSessionsPerDay != null ? String(j.maxVoiceSessionsPerDay) : "");
      setSettingsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [st, ev, cfg, payuCfg, ready] = await Promise.all([
        fetch("/api/org/platform-status"),
        fetch("/api/org/billing-events"),
        fetch("/api/billing/razorpay/config"),
        fetch("/api/billing/payu/config"),
        fetch("/api/billing/readiness"),
      ]);
      if (cancelled) return;
      if (st.ok) setPlatform((await st.json()) as PlatformStatus);
      if (ready.ok) setPayReady((await ready.json()) as PaymentReadiness);
      if (cfg.ok) {
        const c = await cfg.json();
        if (typeof c.proAmountPaise === "number") setProAmountPaise(c.proAmountPaise);
      }
      if (payuCfg.ok) {
        const p = await payuCfg.json();
        if (typeof p.demoAmountInr === "number") setPayuDemoInr(p.demoAmountInr);
        if (typeof p.proAmountInr === "number") setPayuProInr(p.proAmountInr);
        if (p.mode === "production") setPayuMode("production");
      }
      if (ev.ok) {
        const b = await ev.json();
        setBillingEvents(Array.isArray(b.events) ? b.events : []);
        setBillingErr(null);
      } else {
        const b = await ev.json().catch(() => ({}));
        setBillingEvents([]);
        setBillingErr(typeof b.error === "string" ? b.error : "Could not load billing events (run latest migration?)");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveWebhook() {
    setMsg(null);
    const body: Record<string, unknown> = {
      callCompletedWebhookUrl: webhookUrl.trim() || null,
      crmWebhookUrl: crmWebhookUrl.trim() || null,
      hubspotConfig,
      salesforceConfig,
      zohoConfig,
    };
    if (webhookSecret.trim()) body.callCompletedWebhookSecret = webhookSecret.trim();
    if (crmWebhookSecret.trim()) body.crmWebhookSecret = crmWebhookSecret.trim();

    const res = await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setMsg(res.ok ? "Webhook settings saved." : j.error || "Save failed");
    if (res.ok) {
      setWebhookSecret("");
      setCrmWebhookSecret("");
    }
  }

  async function savePlan() {
    setMsg(null);
    const maxParsed = maxSessions.trim() ? parseInt(maxSessions.trim(), 10) : null;
    const res = await fetch("/api/org/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan: plan === "legacy" ? null : plan,
        maxVoiceSessionsPerDay:
          maxParsed !== null && Number.isFinite(maxParsed) && maxParsed > 0 ? maxParsed : null,
      }),
    });
    const j = await res.json();
    setMsg(res.ok ? "Plan & quotas saved." : j.error || "Save failed");
  }

  async function stripe() {
    setMsg(null);
    const res = await fetch("/api/billing/checkout", { method: "POST" });
    const j = await res.json();
    if (!res.ok) {
      setMsg(j.error || "Stripe unavailable");
      return;
    }
    if (j.url) window.location.href = j.url;
  }

  async function razorpayDemo() {
    setMsg(null);
    const res = await fetch("/api/billing/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaise: 10000, receipt: "demo", intent: "demo" }),
    });
    const j = await res.json();
    if (!res.ok) setMsg(j.error || "Razorpay unavailable");
    else setMsg(`Order ${j.orderId} created (${j.amount} ${j.currency}) — complete payment in your Razorpay UI.`);
  }

  async function payUCheckout(intent: "demo" | "pro") {
    setMsg(null);
    const res = await fetch("/api/billing/payu/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent }),
    });
    const j = await res.json();
    if (!res.ok) {
      setMsg(j.error || "PayU unavailable");
      return;
    }
    const f = document.createElement("form");
    f.method = "POST";
    f.action = j.actionUrl as string;
    f.style.display = "none";
    for (const [k, v] of Object.entries(j.fields as Record<string, string>)) {
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = k;
      inp.value = String(v);
      f.appendChild(inp);
    }
    document.body.appendChild(f);
    f.submit();
  }

  async function razorpayPro() {
    setMsg(null);
    const res = await fetch("/api/billing/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountPaise: proAmountPaise, receipt: "pro", intent: "pro" }),
    });
    const j = await res.json();
    if (!res.ok) setMsg(j.error || "Razorpay unavailable");
    else
      setMsg(
        `Pro order ${j.orderId} (${j.amount} ${j.currency}). After payment, webhook can set plan to Pro when notes include your org (dashboard orders only).`,
      );
  }

  async function refreshBillingFeed() {
    const ev = await fetch("/api/org/billing-events");
    if (ev.ok) {
      const b = await ev.json();
      setBillingEvents(Array.isArray(b.events) ? b.events : []);
      setBillingErr(null);
    }
  }

  async function indianNumber() {
    setMsg(null);
    const res = await fetch("/api/telephony/indian-number", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city: "Bengaluru" }),
    });
    const j = await res.json();
    setMsg(JSON.stringify(j, null, 2));
  }

  return (
    <>
      <TopBar title="Settings" />
      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Deployment integrations</CardTitle>
            <CardDescription>
              Live status of this server&apos;s environment (not per-workspace secrets). Configure keys in `.env` / host
              provider.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {platform ? (
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {(
                  [
                    ["Google Calendar", platform.googleCalendar],
                    ["Pinecone RAG", platform.pinecone],
                    ["WhatsApp Cloud", platform.whatsappCloud],
                    ["ElevenLabs", platform.elevenlabs],
                    ["OpenAI", platform.openai],
                    ["Stripe billing + webhook", platform.stripeWebhookSecret],
                    ["Razorpay payments", platform.razorpayPayments],
                    ["Razorpay webhook secret", platform.razorpayWebhookSecret],
                    ["PayU (hosted checkout)", platform.payu],
                    ["Redis", platform.redis],
                  ] as const
                ).map(([label, on]) => (
                  <li key={label} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                    <span>{label}</span>
                    <Badge variant={on ? "primary" : "secondary"}>{on ? "On" : "Off"}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Providers & keys</CardTitle>
            <CardDescription>
              Configure Clerk, Supabase (Mumbai project recommended), LiveKit Cloud, Sarvam, Twilio, Exotel, Stripe, Razorpay,
              and PayU via environment variables. Never commit secrets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              See root <code className="text-xs">README.md</code> and <code className="text-xs">.env.example</code>. Run{" "}
              <code className="text-xs">supabase/verify_schema.sql</code> in the SQL editor after migrations.
            </p>
            <p>For Clerk + Supabase RLS, add a JWT template named `supabase` and enable third-party auth in Supabase.</p>
            <p>
              <Link href="/dashboard/compliance/legal" className="text-primary underline-offset-4 hover:underline">
                Legal drafts
              </Link>{" "}
              (privacy / terms templates, subprocessors, data inventory).
            </p>
          </CardContent>
        </Card>

        {payReady ? (
          <Card
            className={
              payReady.planSyncReady
                ? "border-emerald-500/30 bg-emerald-500/5"
                : payReady.anyChargePath
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border"
            }
          >
            <CardHeader>
              <CardTitle>Payment readiness</CardTitle>
              <CardDescription>
                Derived from environment variables on this server. Add keys in <code className="text-xs">.env</code> when
                you have them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">App URL</span>{" "}
                  {payReady.appUrl ? "set (required for PayU / redirects)" : "missing — set NEXT_PUBLIC_APP_URL"}
                </li>
                <li>
                  <span className="font-medium text-foreground">Stripe</span> checkout:{" "}
                  {payReady.stripe.checkout ? "ready" : "off"} · webhook (plan sync):{" "}
                  {payReady.stripe.webhook ? "ready" : "off"}
                </li>
                <li>
                  <span className="font-medium text-foreground">Razorpay</span> API: {payReady.razorpay.api ? "ready" : "off"}{" "}
                  · webhook: {payReady.razorpay.webhook ? "ready" : "off"}
                </li>
                <li>
                  <span className="font-medium text-foreground">PayU</span> hosted:{" "}
                  {payReady.payu.hostedCheckout ? "ready" : "off"}
                </li>
              </ul>
              {!payReady.anyChargePath ? (
                <p className="text-amber-800 dark:text-amber-200">
                  No payment integration is fully configured yet — Billing buttons will return errors until you add Stripe,
                  Razorpay, or PayU keys.
                </p>
              ) : !payReady.planSyncReady ? (
                <p className="text-amber-800 dark:text-amber-200">
                  Charges may work, but automatic <strong>Pro plan</strong> sync is incomplete: add Stripe webhook secret,
                  Razorpay webhook secret, or complete PayU (key + salt + app URL).
                </p>
              ) : (
                <p className="text-emerald-800 dark:text-emerald-200">
                  At least one path is configured for payments with plan sync (per your enabled providers).
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Public monitor: <code className="text-[10px]">GET /api/health</code> includes a{" "}
                <code className="text-[10px]">payments</code> summary.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Plan & voice quotas</CardTitle>
            <CardDescription>
              <code className="text-xs">free</code> workspaces get a daily cap (Redis +{" "}
              <code className="text-xs">SWARSALES_DEFAULT_FREE_VOICE_SESSIONS_PER_DAY</code> unless you set an explicit max
              below). Requires <code className="text-xs">REDIS_URL</code> for enforcement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={plan} onValueChange={setPlan} disabled={!settingsLoaded}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (daily session cap)</SelectItem>
                  <SelectItem value="pro">Pro (unlimited sessions)</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="legacy">Legacy unlimited (no plan field)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-sess">Max voice sessions / day (optional hard cap)</Label>
              <Input
                id="max-sess"
                placeholder="e.g. 100 — leave empty for defaults"
                value={maxSessions}
                onChange={(e) => setMaxSessions(e.target.value)}
                disabled={!settingsLoaded}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => void savePlan()} disabled={!settingsLoaded}>
              Save plan & quotas
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              Stripe subscriptions, Razorpay orders, and PayU hosted checkout (India). Razorpay dashboard orders attach{" "}
              <code className="text-xs">swarsales_org_id</code> for webhooks; PayU uses server-side txn registry + reverse hash on
              return.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={stripe}>
                Stripe checkout (Pro)
              </Button>
              <Button type="button" variant="outline" onClick={razorpayDemo}>
                Razorpay demo order
              </Button>
              <Button type="button" variant="outline" onClick={() => void razorpayPro()}>
                Razorpay Pro order ({(proAmountPaise / 100).toFixed(0)} INR)
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
              <span className="text-sm font-medium text-foreground">PayU</span>
              <span className="text-xs text-muted-foreground">
                ({payuMode === "production" ? "live" : "test"} · demo ₹{payuDemoInr} · pro ₹{payuProInr})
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => void payUCheckout("demo")}>
                PayU demo (₹{payuDemoInr})
              </Button>
              <Button type="button" variant="outline" onClick={() => void payUCheckout("pro")}>
                PayU Pro (₹{payuProInr})
              </Button>
            </div>
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Razorpay webhook URL (copy into Razorpay dashboard)</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-muted px-2 py-1">
                  {appOrigin ? `${appOrigin}/api/webhooks/razorpay` : "…/api/webhooks/razorpay"}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!appOrigin}
                  onClick={() => {
                    if (appOrigin) void navigator.clipboard.writeText(`${appOrigin}/api/webhooks/razorpay`);
                  }}
                >
                  Copy
                </Button>
              </div>
              <p>Set <code className="text-[10px]">RAZORPAY_WEBHOOK_SECRET</code> to match Razorpay&apos;s signing secret.</p>
            </div>
            <div className="space-y-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Stripe webhook URL (Subscriptions → Pro plan sync)</p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all rounded bg-muted px-2 py-1">
                  {appOrigin ? `${appOrigin}/api/webhooks/stripe` : "…/api/webhooks/stripe"}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!appOrigin}
                  onClick={() => {
                    if (appOrigin) void navigator.clipboard.writeText(`${appOrigin}/api/webhooks/stripe`);
                  }}
                >
                  Copy
                </Button>
              </div>
              <p>
                Add <code className="text-[10px]">STRIPE_WEBHOOK_SECRET</code> (Dashboard → Webhooks → signing secret).
                Listen for <code className="text-[10px]">checkout.session.completed</code> and{" "}
                <code className="text-[10px]">customer.subscription.deleted</code>.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Recent Razorpay events (this workspace)</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => void refreshBillingFeed()}>
                  Refresh
                </Button>
              </div>
              {billingErr ? <p className="text-xs text-amber-700 dark:text-amber-400">{billingErr}</p> : null}
              {billingEvents && billingEvents.length === 0 && !billingErr ? (
                <p className="text-xs text-muted-foreground">No webhook events yet.</p>
              ) : null}
              {billingEvents && billingEvents.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[480px] text-left text-xs">
                    <thead className="border-b border-border bg-muted/50">
                      <tr>
                        <th className="p-2 font-medium">Time</th>
                        <th className="p-2 font-medium">Event</th>
                        <th className="p-2 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingEvents.map((row) => (
                        <tr key={row.razorpay_event_id} className="border-b border-border/60 last:border-0">
                          <td className="whitespace-nowrap p-2 text-muted-foreground">
                            {new Date(row.created_at).toLocaleString()}
                          </td>
                          <td className="p-2">{row.event_type}</td>
                          <td className="p-2 text-muted-foreground">
                            {row.summary && typeof row.summary.orgResolved === "boolean"
                              ? row.summary.orgResolved
                                ? "Org linked"
                                : "No org in notes"
                              : "—"}
                            {row.summary && row.summary.planUpgrade ? " · plan→Pro" : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Enterprise CRM Integrations</CardTitle>
            <CardDescription>
              Directly sync call transcripts, summaries, and ROI data to your CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* HubSpot */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">HubSpot</span>
                  <Badge variant={hubspotConfig.enabled ? "primary" : "secondary"}>{hubspotConfig.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHubspotConfig({ ...hubspotConfig, enabled: !hubspotConfig.enabled })}
                >
                  {hubspotConfig.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://api.hubspot.com/..."
                    value={hubspotConfig.webhookUrl}
                    onChange={(e) => setHubspotConfig({ ...hubspotConfig, webhookUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Signing Secret</Label>
                  <Input
                    type="password"
                    placeholder="Optional"
                    value={hubspotConfig.webhookSecret}
                    onChange={(e) => setHubspotConfig({ ...hubspotConfig, webhookSecret: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Salesforce */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Salesforce</span>
                  <Badge variant={salesforceConfig.enabled ? "primary" : "secondary"}>{salesforceConfig.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSalesforceConfig({ ...salesforceConfig, enabled: !salesforceConfig.enabled })}
                >
                  {salesforceConfig.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://salesforce.com/..."
                    value={salesforceConfig.webhookUrl}
                    onChange={(e) => setSalesforceConfig({ ...salesforceConfig, webhookUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Signing Secret</Label>
                  <Input
                    type="password"
                    placeholder="Optional"
                    value={salesforceConfig.webhookSecret}
                    onChange={(e) => setSalesforceConfig({ ...salesforceConfig, webhookSecret: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Zoho */}
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Zoho CRM</span>
                  <Badge variant={zohoConfig.enabled ? "primary" : "secondary"}>{zohoConfig.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZohoConfig({ ...zohoConfig, enabled: !zohoConfig.enabled })}
                >
                  {zohoConfig.enabled ? "Disable" : "Enable"}
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://hooks.zoho.com/..."
                    value={zohoConfig.webhookUrl}
                    onChange={(e) => setZohoConfig({ ...zohoConfig, webhookUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Signing Secret</Label>
                  <Input
                    type="password"
                    placeholder="Optional"
                    value={zohoConfig.webhookSecret}
                    onChange={(e) => setZohoConfig({ ...zohoConfig, webhookSecret: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Button type="button" variant="default" onClick={() => void saveWebhook()} disabled={!settingsLoaded} className="w-full">
              Save CRM Configurations
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>General Webhooks</CardTitle>
            <CardDescription>
              POST JSON on each completed call (signed with HMAC SHA256 when a secret is set). Optionally mirror the same
              payload to a second CRM URL. Org secrets override env fallbacks{" "}
              <code className="text-xs">SWARSALES_WEBHOOK_SIGNING_SECRET</code> /{" "}
              <code className="text-xs">SWARSALES_CRM_WEBHOOK_SECRET</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="wh-url">Call completed webhook URL</Label>
              <Input
                id="wh-url"
                placeholder="https://your-crm.example/hooks/swarsales"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                disabled={!settingsLoaded}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-secret">Call webhook signing secret (optional)</Label>
              <Input
                id="wh-secret"
                type="password"
                placeholder={settingsLoaded ? "Leave blank to keep existing" : "Loading…"}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                disabled={!settingsLoaded}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-url">CRM / second webhook URL (optional)</Label>
              <Input
                id="crm-url"
                placeholder="https://hooks.zoho.com/..."
                value={crmWebhookUrl}
                onChange={(e) => setCrmWebhookUrl(e.target.value)}
                disabled={!settingsLoaded}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crm-secret">CRM webhook signing secret (optional)</Label>
              <Input
                id="crm-secret"
                type="password"
                placeholder={settingsLoaded ? "Leave blank to keep existing" : "Loading…"}
                value={crmWebhookSecret}
                onChange={(e) => setCrmWebhookSecret(e.target.value)}
                disabled={!settingsLoaded}
              />
            </div>
            <Button type="button" variant="secondary" onClick={() => void saveWebhook()} disabled={!settingsLoaded}>
              Save webhooks
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telephony</CardTitle>
            <CardDescription>Indian number purchase simulation (Exotel keys optional).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="city">City hint</Label>
              <Input id="city" placeholder="Mumbai" />
            </div>
            <Button type="button" onClick={indianNumber}>
              Request number (sim or checklist)
            </Button>
          </CardContent>
        </Card>

        {msg ? (
          <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted p-4 text-xs">{msg}</pre>
        ) : null}
      </div>
    </>
  );
}
