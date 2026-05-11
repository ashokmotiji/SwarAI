"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Headphones, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/readme-preview/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/readme-preview/agent-editor", label: "Agents", icon: Bot },
  { href: "/readme-preview/simulator", label: "Call simulator", icon: Headphones },
  { href: "/readme-preview/settings", label: "Settings", icon: Settings },
];

export function ReadmePreviewSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card/60 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="text-lg font-semibold tracking-tight text-primary">SwarAI</span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">beta</span>
      </div>
      <p className="mb-3 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        README preview (static)
      </p>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-4 px-2 text-xs text-muted-foreground">Data region: India-first defaults (DPDP-aware schema).</p>
    </aside>
  );
}
