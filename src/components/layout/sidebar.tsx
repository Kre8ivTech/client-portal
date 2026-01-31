"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const allNavItems = [
  { href: "/dashboard", icon: Home, label: "Overview" },
  { href: "/dashboard/tickets", icon: Ticket, label: "Tickets" },
  { href: "/dashboard/vault", icon: Shield, label: "Secure Vault" },
  { href: "/dashboard/billing", icon: FileText, label: "Billing & Plans" },
  { href: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
  { href: "/dashboard/kb", icon: BookOpen, label: "Knowledge Base" },
  { href: "/dashboard/invoices", icon: FileText, label: "Invoices" },
  { href: "/dashboard/clients", icon: Users, label: "Clients" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

function getNavItemsForRole(role: Profile["role"]) {
  switch (role) {
    case "super_admin":
      return allNavItems;
    case "staff":
      return allNavItems.filter(
        (item) => !["/dashboard/clients"].includes(item.href),
      );
    case "partner":
      return [
        { href: "/dashboard", icon: Home, label: "Overview" },
        { href: "/dashboard/tickets", icon: Ticket, label: "Tickets" },
        { href: "/dashboard/invoices", icon: FileText, label: "Invoices" },
        { href: "/dashboard/clients", icon: Users, label: "Clients" },
        { href: "/dashboard/settings", icon: Settings, label: "Settings" },
      ];
    case "partner_staff":
      return [
        { href: "/dashboard", icon: Home, label: "Overview" },
        { href: "/dashboard/tickets", icon: Ticket, label: "Tickets" },
      ];
    case "client":
      return [
        { href: "/dashboard", icon: Home, label: "Overview" },
        { href: "/dashboard/tickets", icon: Ticket, label: "Tickets" },
        { href: "/dashboard/invoices", icon: FileText, label: "Invoices" },
        { href: "/dashboard/settings", icon: Settings, label: "Settings" },
      ];
    default:
      return [];
  }
}

export function DashboardSidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const navItems = getNavItemsForRole(profile?.role || "client");

  return (
    <aside className="hidden md:flex w-64 flex-col bg-slate-900 text-white flex-shrink-0">
      <div className="p-6">
        <h2 className="text-xl font-bold tracking-tight">KT-Portal</h2>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">
          Client Portal v2
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium",
                isActive
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800",
              )}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <form action="/auth/signout" method="post">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 gap-3 px-4 py-3"
            type="submit"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </Button>
        </form>
      </div>
    </aside>
  );
}
