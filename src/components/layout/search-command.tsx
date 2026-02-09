"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Ticket,
  FileText,
  Users,
  Settings,
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
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Profile = {
  role?: "super_admin" | "staff" | "partner" | "partner_staff" | "client" | string | null;
  is_account_manager?: boolean;
} | null;

type SearchItem = {
  id: string;
  href: string;
  icon: LucideIcon;
  label: string;
  group: string;
  keywords?: string[];
};

const allSearchItems: SearchItem[] = [
  { id: "dashboard", href: "/dashboard", icon: Home, label: "Dashboard", group: "Main" },
  { id: "projects", href: "/dashboard/projects", icon: FolderKanban, label: "Projects", group: "Support", keywords: ["project", "work"] },
  { id: "tickets", href: "/dashboard/tickets", icon: Ticket, label: "Support Tickets", group: "Support", keywords: ["ticket", "support", "help"] },
  { id: "services", href: "/dashboard/services", icon: Layers, label: "Services", group: "Support", keywords: ["service", "product"] },
  { id: "service-requests", href: "/dashboard/service", icon: Wrench, label: "Service Requests", group: "Support", keywords: ["request", "service"] },
  { id: "contracts", href: "/dashboard/contracts", icon: ClipboardList, label: "Contracts", group: "Support", keywords: ["contract", "agreement"] },
  { id: "capacity", href: "/dashboard/capacity", icon: BarChart3, label: "Capacity", group: "Support", keywords: ["capacity", "availability"] },
  { id: "messages", href: "/dashboard/messages", icon: MessageSquare, label: "Messages", group: "Support", keywords: ["message", "chat", "conversation"] },
  { id: "kb", href: "/dashboard/kb", icon: BookOpen, label: "Knowledge Base", group: "Support", keywords: ["knowledge", "docs", "documentation", "help", "articles"] },
  { id: "user-guide", href: "/dashboard/user-guide", icon: HelpCircle, label: "User Guide", group: "Support", keywords: ["guide", "help", "tutorial"] },
  { id: "invoices", href: "/dashboard/invoices", icon: FileText, label: "Invoices", group: "Account", keywords: ["invoice", "bill", "payment"] },
  { id: "vault", href: "/dashboard/vault", icon: Lock, label: "Secure Vault", group: "Account", keywords: ["vault", "secure", "safe"] },
  { id: "billing", href: "/dashboard/billing", icon: CreditCard, label: "Billing & Plans", group: "Account", keywords: ["billing", "plan", "subscription"] },
  { id: "profile", href: "/dashboard/profile", icon: User, label: "Profile", group: "Account", keywords: ["profile", "account", "user"] },
  { id: "settings", href: "/dashboard/settings", icon: Settings, label: "General Settings", group: "Settings", keywords: ["settings", "preferences", "config"] },
  { id: "white-label", href: "/dashboard/settings/white-label", icon: Palette, label: "White Label", group: "Settings", keywords: ["branding", "white label", "theme"] },
  { id: "security", href: "/dashboard/settings/security", icon: Shield, label: "Security", group: "Settings", keywords: ["security", "password", "2fa"] },
  { id: "notifications", href: "/dashboard/settings/notifications", icon: Bell, label: "Notifications", group: "Settings", keywords: ["notifications", "alerts"] },
  { id: "email-templates", href: "/dashboard/settings/email-templates", icon: Mail, label: "Email Templates", group: "Settings", keywords: ["email", "template"] },
  { id: "file-storage", href: "/dashboard/settings/file-storage", icon: HardDrive, label: "File Storage", group: "Settings", keywords: ["storage", "file", "s3"] },
  { id: "integrations", href: "/dashboard/integrations", icon: Plug, label: "Integrations", group: "Settings", keywords: ["integration", "api", "connect"] },
  { id: "fin-invoicing", href: "/dashboard/financials/invoicing", icon: FileText, label: "Invoicing & Revenue", group: "Financial", keywords: ["invoice", "revenue", "income"] },
  { id: "fin-receivables", href: "/dashboard/financials/receivables", icon: DollarSign, label: "Accounts Receivable", group: "Financial", keywords: ["receivable", "payment", "collections"] },
  { id: "fin-time", href: "/dashboard/financials/time-tracking", icon: Clock, label: "Time & Utilization", group: "Financial", keywords: ["time", "tracking", "hours"] },
  { id: "fin-subscriptions", href: "/dashboard/financials/subscriptions", icon: Layers, label: "Subscriptions", group: "Financial", keywords: ["subscription", "recurring"] },
  { id: "fin-cash", href: "/dashboard/financials/cash-flow", icon: LineChart, label: "Cash & Runway", group: "Financial", keywords: ["cash", "flow", "runway"] },
  { id: "fin-budgeting", href: "/dashboard/financials/budgeting", icon: BarChart3, label: "Budgets & Forecasts", group: "Financial", keywords: ["budget", "forecast"] },
  { id: "fin-reports", href: "/dashboard/financials/reports", icon: FileText, label: "Financial Reports", group: "Financial", keywords: ["report", "financial"] },
  { id: "clients", href: "/dashboard/clients", icon: Users, label: "Clients", group: "Admin", keywords: ["client", "customer"] },
  { id: "users", href: "/dashboard/users", icon: UserCog, label: "User Management", group: "Admin", keywords: ["user", "management", "people"] },
  { id: "staff-mgmt", href: "/dashboard/admin/staff-management", icon: UserCog, label: "Staff Management", group: "Admin", keywords: ["staff", "employee"] },
  { id: "permissions", href: "/dashboard/admin/permissions", icon: Shield, label: "Permissions", group: "Admin", keywords: ["permission", "role", "access"] },
  { id: "tenants", href: "/dashboard/tenants", icon: Building2, label: "Tenants", group: "Admin", keywords: ["tenant", "organization"] },
  { id: "plans", href: "/dashboard/plans", icon: Layers, label: "Plans", group: "Admin", keywords: ["plan", "pricing"] },
  { id: "financials", href: "/dashboard/financials", icon: DollarSign, label: "Financials", group: "Admin", keywords: ["financial", "money"] },
  { id: "reports", href: "/dashboard/reports", icon: LineChart, label: "Reports", group: "Admin", keywords: ["report", "analytics"] },
  { id: "time", href: "/dashboard/time", icon: Clock, label: "Time Tracking", group: "Admin", keywords: ["time", "tracking"] },
  { id: "forms", href: "/dashboard/forms", icon: FileEdit, label: "Forms", group: "Admin", keywords: ["form", "template"] },
  { id: "admin-services", href: "/dashboard/admin/services", icon: Wrench, label: "Manage Services", group: "Admin", keywords: ["service", "admin"] },
  { id: "admin-contracts", href: "/dashboard/admin/contracts", icon: ClipboardList, label: "Manage Contracts", group: "Admin", keywords: ["contract", "admin"] },
  { id: "admin-notifications", href: "/dashboard/admin/notifications", icon: Bell, label: "Notifications", group: "Admin", keywords: ["notification", "admin"] },
  { id: "sla-settings", href: "/dashboard/admin/settings/sla", icon: Clock, label: "SLA Settings", group: "Admin", keywords: ["sla", "service level"] },
  { id: "auth-settings", href: "/dashboard/admin/settings/auth", icon: Shield, label: "Auth Settings", group: "Admin", keywords: ["auth", "authentication"] },
  { id: "audit", href: "/dashboard/audit", icon: History, label: "Audit Log", group: "Admin", keywords: ["audit", "log", "history"] },
];

function getItemsForRole(role: NonNullable<Profile>["role"], isAccountManager: boolean): string[] {
  const supportClient = [
    "tickets",
    "service-requests",
    "contracts",
    "messages",
    "kb",
  ];
  const accountBase = [
    "invoices",
    "settings",
    "vault",
    "billing",
    "security",
    "file-storage",
    "profile",
    "notifications",
  ];
  const accountBaseNoInvoices = accountBase.filter((id) => id !== "invoices");

  switch (role) {
    case "super_admin":
      return allSearchItems.map((item) => item.id);
    case "staff":
      return [
        "dashboard",
        ...supportClient,
        "user-guide",
        "capacity",
        ...(isAccountManager ? accountBase : accountBaseNoInvoices),
        "email-templates",
        "projects",
        "fin-invoicing",
        "fin-receivables",
        "fin-time",
        "fin-subscriptions",
        "fin-cash",
        "fin-budgeting",
        "fin-reports",
        "users",
        "plans",
        "financials",
        "reports",
        "time",
        "forms",
        "staff-mgmt",
        "admin-services",
        "admin-contracts",
        "admin-notifications",
      ];
    case "partner":
      return [
        "dashboard",
        ...supportClient,
        ...accountBase,
        "white-label",
        "clients",
        "projects",
        "plans",
        "reports",
      ];
    case "partner_staff":
      return [
        "dashboard",
        ...supportClient,
        "projects",
        "invoices",
        "settings",
        "file-storage",
        "profile",
        "security",
        "notifications",
      ];
    case "client":
      return ["dashboard", ...supportClient, "projects", ...accountBase];
    default:
      return [];
  }
}

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
}

export function SearchCommand({ open, onOpenChange, profile }: SearchCommandProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const role = (profile?.role ?? "client") as "super_admin" | "staff" | "partner" | "partner_staff" | "client";
  const isAccountManager = profile?.is_account_manager ?? false;
  const allowedItemIds = useMemo(
    () => getItemsForRole(role, isAccountManager),
    [role, isAccountManager]
  );

  const filteredItems = useMemo(() => {
    const availableItems = allSearchItems.filter((item) =>
      allowedItemIds.includes(item.id)
    );

    if (!search.trim()) {
      return availableItems;
    }

    const query = search.toLowerCase();
    return availableItems.filter((item) => {
      const labelMatch = item.label.toLowerCase().includes(query);
      const groupMatch = item.group.toLowerCase().includes(query);
      const keywordMatch = item.keywords?.some((kw) => kw.toLowerCase().includes(query));
      return labelMatch || groupMatch || keywordMatch;
    });
  }, [search, allowedItemIds]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelectedIndex(0);
    }
  }, [open]);

  const handleSelect = (href: string) => {
    router.push(href);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex].href);
    }
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push(item);
    });
    return groups;
  }, [filteredItems]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center gap-2 border-b pb-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Search pages and sections..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 focus-visible:ring-0 shadow-none px-0 h-8"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found for "{search}"
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([group, items]) => (
                <div key={group}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {group}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item, idx) => {
                      const globalIndex = filteredItems.findIndex((fi) => fi.id === item.id);
                      const isSelected = globalIndex === selectedIndex;
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item.href)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                            isSelected
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-muted"
                          )}
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded">Enter</kbd> Select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded">Esc</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
