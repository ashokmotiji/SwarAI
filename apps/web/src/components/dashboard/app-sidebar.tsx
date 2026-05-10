"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Headphones,
  History,
  LayoutDashboard,
  FileText,
  Scale,
  Settings,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

function linkActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/compliance") return pathname === "/dashboard/compliance";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const links = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/agents", label: "Agents", icon: Bot },
  { href: "/dashboard/simulator", label: "Call simulator", icon: Headphones },
  { href: "/dashboard/calls", label: "Call history", icon: History },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/compliance", label: "Compliance", icon: Scale },
  { href: "/dashboard/compliance/legal", label: "Legal drafts", icon: FileText },
  { href: "/dashboard/help", label: "Help", icon: Sparkles },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card/60 p-4">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
        <span className="text-lg font-semibold tracking-tight text-primary">SwarAI</span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">beta</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = linkActive(pathname, href);
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
