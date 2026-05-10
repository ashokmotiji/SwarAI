"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MarketplacePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: async () => {
      const res = await fetch("/api/marketplace/templates");
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j.templates as {
        id: string;
        slug: string;
        title: string;
        description: string;
        category: string;
        is_pro: boolean;
      }[];
    },
  });

  const install = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch("/api/marketplace/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });

  return (
    <>
      <TopBar title="Marketplace" />
      <div className="space-y-6 p-6">
        <p className="text-sm text-muted-foreground">
          Install curated Indian agent templates into your workspace (editable after install).
        </p>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  {t.is_pro ? <Badge variant="secondary">Pro</Badge> : <Badge variant="primary">Free</Badge>}
                </div>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase text-muted-foreground">{t.category}</span>
                <Button size="sm" disabled={install.isPending} onClick={() => install.mutate(t.id)}>
                  Install
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {install.error ? <p className="text-sm text-red-600">{(install.error as Error).message}</p> : null}
      </div>
    </>
  );
}
