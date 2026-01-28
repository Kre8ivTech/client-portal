"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Ticket, FileText, Users, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Overview" },
  { href: "/dashboard/tickets", icon: Ticket, label: "Tickets" },
  { href: "/dashboard/invoices", icon: FileText, label: "Invoices" },
  { href: "/dashboard/clients", icon: Users, label: "Clients" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

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
