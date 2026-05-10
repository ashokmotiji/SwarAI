import Link from "next/link";
import { ArrowRight, Globe2, Mic, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NavAuth } from "@/components/marketing/nav-auth";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold text-primary">SwarAI</span>
          <Badge variant="secondary">open-core</Badge>
        </div>
        <nav className="flex items-center gap-3">
          <NavAuth />
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-10">
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium text-secondary">India-first · LiveKit · Sarvam AI</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              The voice agent platform built for Indian languages—and global scale.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              SwarAI pairs <span className="font-medium text-foreground">LiveKit</span> realtime rooms with{" "}
              <span className="font-medium text-foreground">Sarvam</span> Saaras v3 STT, Bulbul v3 TTS, and Sarvam-m
              LLM defaults. Add Twilio + Exotel telephony, a no-code builder, and self-hosting with Docker when you need
              it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/sign-up">
                  Launch console <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/dashboard/simulator">Try simulator</Link>
              </Button>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Compared to generic voice APIs: deeper Indian language coverage, Hinglish-friendly defaults, UPI-safe
              playbooks, and a dashboard tuned for operators—not only developers.
            </p>
          </div>
          <Card className="border-primary/20 bg-gradient-to-br from-card to-accent/40">
            <CardHeader>
              <CardTitle>Why teams pick SwarAI</CardTitle>
              <CardDescription>Production patterns without losing operator simplicity.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Feature icon={Mic} title="12+ Indian languages" desc="Sarvam-first stack with configurable fallbacks." />
              <Feature icon={Zap} title="Sub-400ms target" desc="LiveKit SFU + tuned agent worker path." />
              <Feature icon={Globe2} title="Phone + web + embed" desc="Twilio, Exotel, and iframe-friendly voice UIs." />
              <Feature icon={Shield} title="DPDP-ready schema" desc="India region defaults, RLS, and audit hooks." />
            </CardContent>
          </Card>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>vs. Vapi / Retell</CardTitle>
              <CardDescription>Same class of product—more India-native defaults.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Native Sarvam wiring, Hinglish-aware prompting templates, UPI-safe tool guidance, and marketplace agents for
              Indian use-cases—without blocking global English deployments.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Open-core control</CardTitle>
              <CardDescription>Docker Compose for the full control plane.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Run dashboard + worker beside your own LiveKit deployment. Bring Mumbai-region Supabase for data residency
              alignment.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Self-improving prompts</CardTitle>
              <CardDescription>Every 10 completed calls triggers a review pass.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Transcripts land in Postgres; suggestion jobs can run with OpenAI or manual review—your choice.
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: typeof Mic; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
