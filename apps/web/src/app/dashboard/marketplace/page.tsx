"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/dashboard/top-bar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState("all");
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

  const categories = ["all", ...new Set(data?.map((t) => t.category) ?? [])];
  const filteredTemplates = data?.filter((t) => activeTab === "all" || t.category === activeTab);

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Install curated SwarSales agent templates into your workspace.
          </p>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              {categories.map((c) => (
                <TabsTrigger key={c} value={c} className="capitalize">
                  {c}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(filteredTemplates ?? []).map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  {t.is_pro ? <Badge variant="secondary">Pro</Badge> : <Badge variant="default">Free</Badge>}
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
