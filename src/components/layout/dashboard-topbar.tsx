"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, User, Settings, LogOut, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { WorkTimerButton } from "@/components/time/work-timer-button";
import { SearchCommand } from "@/components/layout/search-command";

type UserInfo = { email?: string | null };
type ProfileInfo = {
  name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  organization_id?: string | null;
} | null;

const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  tickets: "Tickets",
  vault: "Secure Vault",
  billing: "Billing & Plans",
  messages: "Messages",
  kb: "Knowledge Base",
  invoices: "Invoices",
  clients: "Clients",
  settings: "Settings",
  capacity: "Capacity",
  profile: "Profile",
  dispute: "Dispute",
  service: "Service",
  contracts: "Contracts",
  users: "User Management",
  tenants: "Tenants",
  financials: "Financials",
  reports: "Reports",
  time: "Time Tracking",
  forms: "Forms",
  audit: "Audit Log",
};

function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length <= 1) return [{ label: "Overview" }];

  const crumbs: { label: string; href?: string }[] = [{ label: "Overview", href: "/dashboard" }];
  let pathSoFar = "/dashboard";
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    pathSoFar += `/${seg}`;
    const label =
      segmentLabels[seg] ?? (seg.match(/^[0-9a-f-]{36}$/i) ? "Detail" : seg);
    crumbs.push({
      label,
      href: i < segments.length - 1 ? pathSoFar : undefined,
    });
  }
  return crumbs;
}

export function DashboardTopbar({
  user,
  profile,
  tickets = [],
  planAssignments = [],
}: {
  user: UserInfo;
  profile: ProfileInfo;
  tickets?: Array<{ id: string; ticket_number: number; subject: string }>;
  planAssignments?: Array<{
    id: string;
    plans: { name: string } | null;
    organizations: { name: string } | null;
  }>;
}) {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  const displayName = profile?.name?.trim() || user.email?.split("@")[0] || "User";
  const isSuperAdmin = profile?.role === "super_admin";
  const isStaff = profile?.role === "staff";
  const showTimer = isSuperAdmin || isStaff;

  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 shadow-sm flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
            {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground font-medium transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="font-semibold text-foreground truncate">{crumb.label}</span>
            )}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Button
          variant="outline"
          onClick={() => setSearchOpen(true)}
          className="relative h-9 w-9 p-0 md:w-auto md:px-3 md:gap-2"
        >
          <Search className="h-4 w-4" />
          <span className="hidden md:inline text-sm text-muted-foreground">
            Search
          </span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ml-auto">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
        {showTimer && profile?.organization_id && (
          <WorkTimerButton
            organizationId={profile.organization_id}
            tickets={tickets}
            planAssignments={planAssignments}
          />
        )}
        {isSuperAdmin && (
          <span className="hidden sm:inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            Administrator
          </span>
        )}
        <p className="hidden sm:block text-sm text-muted-foreground">
          Welcome back, <span className="font-medium text-foreground">{displayName}</span>
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{displayName}</p>
                {user.email && (
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action="/auth/signout" method="post" className="w-full">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        profile={profile}
      />
    </header>
  );
}
