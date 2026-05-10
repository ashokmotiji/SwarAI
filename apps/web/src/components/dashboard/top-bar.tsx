"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TopBar({ title }: { title: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
      <h1 className="text-sm font-semibold tracking-tight sm:text-base">{title}</h1>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">Marketing site</Link>
        </Button>
        <UserButton />
      </div>
    </header>
  );
}
