"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Ticket,
  FileText,
  Users,
  Settings,
  LogOut,
  Shield,
  User,
  Bell,
  Wrench,
  MessageSquare,
  BookOpen,
  BarChart3,
  Lock,
  CreditCard,
  Palette,
  Building2,
  DollarSign,
  ClipboardList,
  LineChart,
  Clock,
  FileEdit,
  History,
  UserCog,
  Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Merged shape: users (id, organization_id, email, role) + user_profiles (name, avatar_url, organization_name, organization_slug)
type Profile = {
  id: string;
  organization_id: string | null;
  email: string;
  role: "super_admin" | "staff" | "partner" | "partner_staff" | "client";
  name: string | null;
  avatar_url: string | null;
  organization_name: string | null;
  organization_slug: string | null;
} | null;

type NavItem = { href: string; icon: LucideIcon; label: string };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [{ href: "/dashboard", icon: Home, label: "Dashboard" }],
  },
  {
    label: "Support",
    items: [
      { href: "/dashboard/tickets", icon: Ticket, label: "Support Tickets" },
      { href: "/dashboard/service", icon: Wrench, label: "Service Requests" },
      { href: "/dashboard/contracts", icon: ClipboardList, label: "Contracts" },
      { href: "/dashboard/capacity", icon: BarChart3, label: "Capacity" },
      { href: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
      { href: "/dashboard/kb", icon: BookOpen, label: "Knowledge Base" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/invoices", icon: FileText, label: "Invoices" },
      { href: "/dashboard/vault", icon: Lock, label: "Secure Vault" },
      { href: "/dashboard/billing", icon: CreditCard, label: "Billing & Plans" },
      { href: "/dashboard/profile", icon: User, label: "Profile" },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/dashboard/settings", icon: Settings, label: "General" },
      { href: "/dashboard/settings#white-label", icon: Palette, label: "White Label" },
      { href: "/dashboard/settings#security", icon: Shield, label: "Security" },
      { href: "/dashboard/settings#notifications", icon: Bell, label: "Notifications" },
      { href: "/dashboard/integrations", icon: Plug, label: "Integrations" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/clients", icon: Users, label: "Clients" },
      { href: "/dashboard/users", icon: UserCog, label: "User Management" },
      { href: "/dashboard/tenants", icon: Building2, label: "Tenants" },
      { href: "/dashboard/financials", icon: DollarSign, label: "Financials" },
      { href: "/dashboard/reports", icon: LineChart, label: "Reports" },
      { href: "/dashboard/time", icon: Clock, label: "Time Tracking" },
      { href: "/dashboard/forms", icon: FileEdit, label: "Forms" },
      { href: "/dashboard/audit", icon: History, label: "Audit Log" },
    ],
  },
];

// Role visibility: client = Support + Account; partner = + White Label + Clients + Reports; staff = + Capacity + User Mgmt + Financials + Reports + Time + Forms; super_admin = full + Tenants + Audit.
function getHrefsForRole(role: NonNullable<Profile>["role"]): string[] {
  const supportClient = [
    "/dashboard/tickets",
    "/dashboard/service",
    "/dashboard/contracts",
    "/dashboard/messages",
    "/dashboard/kb",
  ];
  const accountBase = [
    "/dashboard/invoices",
    "/dashboard/settings",
    "/dashboard/vault",
    "/dashboard/billing",
    "/dashboard/settings#security",
    "/dashboard/profile",
    "/dashboard/settings#notifications",
  ];
  const whiteLabel = "/dashboard/settings#white-label";
  const adminStaff = [
    "/dashboard/users",
    "/dashboard/financials",
    "/dashboard/reports",
    "/dashboard/time",
    "/dashboard/forms",
  ];

  switch (role) {
    case "super_admin":
      return [
        "/dashboard",
        ...supportClient,
        "/dashboard/capacity",
        ...accountBase,
        whiteLabel,
        "/dashboard/integrations",
        "/dashboard/clients",
        ...adminStaff,
        "/dashboard/tenants",
        "/dashboard/audit",
      ];
    case "staff":
      return [
        "/dashboard",
        ...supportClient,
        "/dashboard/capacity",
        ...accountBase,
        ...adminStaff,
      ];
    case "partner":
      return [
        "/dashboard",
        ...supportClient,
        ...accountBase,
        whiteLabel,
        "/dashboard/clients",
        "/dashboard/reports",
      ];
    case "partner_staff":
      return [
        "/dashboard",
        ...supportClient,
        "/dashboard/invoices",
        "/dashboard/settings",
        "/dashboard/profile",
        "/dashboard/settings#security",
        "/dashboard/settings#notifications",
      ];
    case "client":
      return [
        "/dashboard",
        ...supportClient,
        ...accountBase,
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
  const [hash, setHash] = useState("");

  // Track hash changes for proper active state on hash-based navigation
  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  // Admin links (e.g. Clients) require profile.role === "super_admin". Ensure profile is loaded (RLS: "Users can read their own profile").
  const role = profile?.role ?? "client";
  const allowedHrefs = getHrefsForRole(role);
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
          // eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided logo URL
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

          const isAdminGroup = group.label === "Admin";
          const showAdminBadge = isAdminGroup && role === "super_admin";

          return (
            <div key={group.label}>
              <p className="px-3 mb-2 text-xs font-semibold text-sidebar-muted uppercase tracking-wider flex items-center gap-2">
                {group.label}
                {showAdminBadge && (
                  <span className="rounded bg-sidebar-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-accent">
                    Admin
                  </span>
                )}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const [itemPath, itemHash] = item.href.split("#");

                  let isActive = false;
                  if (itemHash) {
                    // Hash-based route: must match path AND hash exactly
                    isActive = pathname === itemPath && hash === `#${itemHash}`;
                  } else if (item.href === "/dashboard") {
                    // Dashboard home: exact match only, no hash
                    isActive = pathname === "/dashboard" && !hash;
                  } else if (pathname === itemPath) {
                    // Exact path match with no hash in the item
                    // Only active if there's no hash in the URL, or if it's not a settings page
                    isActive = itemPath !== "/dashboard/settings" || !hash;
                  } else {
                    // Nested route: startsWith but not for items that have hash siblings
                    isActive = pathname.startsWith(itemPath + "/");
                  }
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
