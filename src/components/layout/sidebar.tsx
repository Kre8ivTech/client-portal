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
  Layers,
  FolderKanban,
  HelpCircle,
  HardDrive,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getActiveNavHref } from "@/lib/navigation/get-active-nav-href";

// Merged shape: users (id, organization_id, email, role, is_account_manager) + user_profiles (name, avatar_url, organization_name, organization_slug)
type Profile = {
  id: string;
  organization_id: string | null;
  email: string;
  role: "super_admin" | "staff" | "partner" | "partner_staff" | "client";
  is_account_manager: boolean;
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
      { href: "/dashboard/services", icon: Layers, label: "Services" },
      { href: "/dashboard/service", icon: Wrench, label: "Service Requests" },
      { href: "/dashboard/contracts", icon: ClipboardList, label: "Contracts" },
      { href: "/dashboard/capacity", icon: BarChart3, label: "Capacity" },
      { href: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
      { href: "/dashboard/kb", icon: BookOpen, label: "Knowledge Base" },
      { href: "/dashboard/user-guide", icon: HelpCircle, label: "User Guide" },
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
      { href: "/dashboard/settings/white-label", icon: Palette, label: "White Label" },
      { href: "/dashboard/settings/security", icon: Shield, label: "Security" },
      { href: "/dashboard/settings/notifications", icon: Bell, label: "Notifications" },
      { href: "/dashboard/settings/email-templates", icon: Mail, label: "Email Templates" },
      { href: "/dashboard/settings/file-storage", icon: HardDrive, label: "File Storage" },
      { href: "/dashboard/integrations", icon: Plug, label: "Integrations" },
    ],
  },
  {
    label: "Financial Management",
    items: [
      { href: "/dashboard/financials/invoicing", icon: FileText, label: "Invoicing & Revenue" },
      { href: "/dashboard/financials/receivables", icon: DollarSign, label: "Accounts Receivable" },
      { href: "/dashboard/financials/time-tracking", icon: Clock, label: "Time & Utilization" },
      { href: "/dashboard/financials/subscriptions", icon: Layers, label: "Subscriptions" },
      { href: "/dashboard/financials/cash-flow", icon: LineChart, label: "Cash & Runway" },
      { href: "/dashboard/financials/budgeting", icon: BarChart3, label: "Budgets & Forecasts" },
      { href: "/dashboard/financials/reports", icon: FileText, label: "Financial Reports" },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/dashboard/clients", icon: Users, label: "Clients" },
      { href: "/dashboard/projects", icon: FolderKanban, label: "Projects" },
      { href: "/dashboard/users", icon: UserCog, label: "User Management" },
      { href: "/dashboard/admin/staff-management", icon: UserCog, label: "Staff Management" },
      { href: "/dashboard/admin/permissions", icon: Shield, label: "Permissions" },
      { href: "/dashboard/tenants", icon: Building2, label: "Tenants" },
      { href: "/dashboard/plans", icon: Layers, label: "Plans" },
      { href: "/dashboard/financials", icon: DollarSign, label: "Financials" },
      { href: "/dashboard/reports", icon: LineChart, label: "Reports" },
      { href: "/dashboard/time", icon: Clock, label: "Time Tracking" },
      { href: "/dashboard/forms", icon: FileEdit, label: "Forms" },
      { href: "/dashboard/admin/services", icon: Wrench, label: "Manage Services" },
      { href: "/dashboard/admin/contracts", icon: ClipboardList, label: "Manage Contracts" },
      { href: "/dashboard/admin/notifications", icon: Bell, label: "Notifications" },
      { href: "/dashboard/admin/settings/sla", icon: Clock, label: "SLA Settings" },
      { href: "/dashboard/audit", icon: History, label: "Audit Log" },
    ],
  },
];

// Role visibility: client = Support + Account; partner = + White Label + Clients + Reports; staff = + Capacity + User Mgmt + Financials + Reports + Time + Forms; super_admin = full + Tenants + Audit.
// Note: Staff without is_account_manager flag cannot see invoices.
function getHrefsForRole(role: NonNullable<Profile>["role"], isAccountManager: boolean): string[] {
  const supportClient = [
    "/dashboard/tickets",
    "/dashboard/service",
    "/dashboard/contracts",
    "/dashboard/messages",
    "/dashboard/kb",
  ];
  const userGuide = "/dashboard/user-guide";
  const accountBase = [
    "/dashboard/invoices",
    "/dashboard/settings",
    "/dashboard/vault",
    "/dashboard/billing",
    "/dashboard/settings/security",
    "/dashboard/settings/file-storage",
    "/dashboard/profile",
    "/dashboard/settings/notifications",
  ];
  // Account items without invoices (for non-account-manager staff)
  const accountBaseNoInvoices = accountBase.filter((href) => href !== "/dashboard/invoices");
  const whiteLabel = "/dashboard/settings/white-label";
  const adminStaff = [
    "/dashboard/users",
    "/dashboard/plans",
    "/dashboard/financials",
    "/dashboard/financials/invoicing",
    "/dashboard/financials/receivables",
    "/dashboard/financials/time-tracking",
    "/dashboard/financials/subscriptions",
    "/dashboard/financials/cash-flow",
    "/dashboard/financials/budgeting",
    "/dashboard/financials/reports",
    "/dashboard/reports",
    "/dashboard/time",
    "/dashboard/forms",
  ];

  switch (role) {
    case "super_admin":
      return [
        "/dashboard",
        ...supportClient,
        userGuide,
        "/dashboard/capacity",
        ...accountBase,
        whiteLabel,
        "/dashboard/settings/email-templates",
        "/dashboard/integrations",
        "/dashboard/clients",
        "/dashboard/projects",
        ...adminStaff,
        "/dashboard/admin/staff-management",
        "/dashboard/admin/permissions",
        "/dashboard/admin/services",
        "/dashboard/admin/contracts",
        "/dashboard/admin/notifications",
        "/dashboard/admin/settings/sla",
        "/dashboard/tenants",
        "/dashboard/audit",
      ];
    case "staff":
      // Staff with account manager flag sees invoices, otherwise they don't
      return [
        "/dashboard",
        ...supportClient,
        userGuide,
        "/dashboard/capacity",
        ...(isAccountManager ? accountBase : accountBaseNoInvoices),
        "/dashboard/settings/email-templates",
        "/dashboard/projects",
        ...adminStaff,
        "/dashboard/admin/staff-management",
        "/dashboard/admin/services",
        "/dashboard/admin/contracts",
        "/dashboard/admin/notifications",
      ];
    case "partner":
      return [
        "/dashboard",
        ...supportClient,
        ...accountBase,
        whiteLabel,
        "/dashboard/clients",
        "/dashboard/projects",
        "/dashboard/plans",
        "/dashboard/reports",
      ];
    case "partner_staff":
      return [
        "/dashboard",
        ...supportClient,
        "/dashboard/projects",
        "/dashboard/invoices",
        "/dashboard/settings",
        "/dashboard/settings/file-storage",
        "/dashboard/profile",
        "/dashboard/settings#security",
        "/dashboard/settings#notifications",
      ];
    case "client":
      return ["/dashboard", ...supportClient, "/dashboard/projects", ...accountBase];
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

  // Admin links (e.g. Clients) require profile.role === "super_admin". Ensure profile is loaded (RLS: "Users can read their own profile").
  const role = profile?.role ?? "client";
  const isAccountManager = profile?.is_account_manager ?? false;
  const allowedHrefs = getHrefsForRole(role, isAccountManager);
  const appName = branding?.app_name ?? "KT-Portal";
  const tagline = branding?.tagline ?? "Client Portal";
  const logoUrl = branding?.logo_url;
  const initials = appName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedHrefs.includes(item.href)),
    }))
    .filter((group) => group.items.length > 0);

  const activeHref = getActiveNavHref(
    pathname,
    visibleNavGroups.flatMap((g) => g.items.map((i) => i.href)),
  );

  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground flex-shrink-0 border-r border-sidebar-muted/30">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-sidebar-muted/30">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided logo URL
          <img src={logoUrl} alt={appName} className="h-9 w-auto max-w-full object-contain" />
        ) : (
          <>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-white font-bold text-sm">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">{appName}</h2>
              <p className="text-xs text-sidebar-muted uppercase tracking-wider truncate">{tagline}</p>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {visibleNavGroups.map((group) => {
          const items = group.items;
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
                  const isActive = item.href === activeHref;
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
