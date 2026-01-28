import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { DashboardSidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar className="hidden md:flex" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-slate-50 min-h-0 min-w-0">
        <header className="h-16 border-b bg-white flex items-center justify-between px-4 md:px-8 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <button className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-md">
                  <Menu size={24} />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-slate-900 border-r-slate-800 text-white">
                 <DashboardSidebar className="flex w-full h-full" />
              </SheetContent>
            </Sheet>
            <h1 className="font-semibold text-lg">Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors group"
            >
              <span className="text-sm text-slate-500 hidden sm:inline group-hover:text-slate-900 transition-colors">
                {user.email}
              </span>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold shadow-sm shadow-primary/20">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            </Link>
          </div>
        </header>

        <main className="p-8 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
