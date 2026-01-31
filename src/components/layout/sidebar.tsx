"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Ticket,
  FileText,
  Users,
  Settings,
  LogOut,
  Shield,
  MessageSquare,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type NavItem = { href: string; icon: LucideIcon; label: string };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [{ href: "/dashboard", icon: Home, label: "Overview" }],
  },
  {
    label: "Support",
    items: [
      { href: "/dashboard/tickets", icon: Ticket, label: "Tickets" },
      { href: "/dashboard/capacity", icon: BarChart3, label: "Capacity" },
      { href: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
      { href: "/dashboard/kb", icon: BookOpen, label: "Knowledge Base" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/vault", icon: Shield, label: "Secure Vault" },
      { href: "/dashboard/billing", icon: FileText, label: "Billing & Plans" },
      { href: "/dashboard/invoices", icon: FileText, label: "Invoices" },
      { href: "/dashboard/settings", icon: Settings, label: "Settings" },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/dashboard/clients", icon: Users, label: "Clients" }],
  },
];

function getHrefsForRole(role: Profile["role"]): string[] {
  switch (role) {
    case "super_admin":
      return [
        "/dashboard",
        "/dashboard/tickets",
        "/dashboard/capacity",
        "/dashboard/vault",
        "/dashboard/billing",
        "/dashboard/messages",
        "/dashboard/kb",
        "/dashboard/invoices",
        "/dashboard/clients",
        "/dashboard/settings",
      ];
    case "staff":
      return [
        "/dashboard",
        "/dashboard/tickets",
        "/dashboard/capacity",
        "/dashboard/vault",
        "/dashboard/billing",
        "/dashboard/messages",
        "/dashboard/kb",
        "/dashboard/invoices",
        "/dashboard/settings",
      ];
    case "partner":
      return [
        "/dashboard",
        "/dashboard/tickets",
        "/dashboard/invoices",
        "/dashboard/clients",
        "/dashboard/settings",
      ];
    case "partner_staff":
      return ["/dashboard", "/dashboard/tickets"];
    case "client":
      return [
        "/dashboard",
        "/dashboard/tickets",
        "/dashboard/invoices",
        "/dashboard/settings",
      ];
    default:
      return [];
  }
}

export type SidebarBranding = {
  app_name: string;
  tagline: string | null;
  logo_url: string | null;
};

export function DashboardSidebar({
  profile,
  branding,
}: {
  profile: Profile | null;
  branding?: SidebarBranding | null;
}) {
  const pathname = usePathname();
  const allowedHrefs = getHrefsForRole(profile?.role || "client");
  const appName = branding?.app_name ?? "KT-Portal";
  const tagline = branding?.tagline ?? "Client Portal";
  const logoUrl = branding?.logo_url;
  const initials = appName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground flex-shrink-0 border-r border-sidebar-muted/30">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-muted/30">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={appName}
            className="h-9 w-auto max-w-[120px] object-contain shrink-0"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-white font-bold text-sm">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">{appName}</h2>
          <p className="text-xs text-sidebar-muted uppercase tracking-wider truncate">
            {tagline}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navGroups.map((group) => {
          const items = group.items.filter((item) => allowedHrefs.includes(item.href));
          if (items.length === 0) return null;

          return (
            <div key={group.label}>
              <p className="px-3 mb-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-white"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-muted/20 hover:text-sidebar-foreground",
                        )}
                      >
                        <item.icon size={18} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-muted/30">
        <form action="/auth/signout" method="post">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-muted/20 gap-3 px-3 py-2.5 h-auto font-medium"
            type="submit"
          >
            <LogOut size={18} className="shrink-0" />
            <span>Sign Out</span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
