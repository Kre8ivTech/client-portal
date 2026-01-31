import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/sidebar";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { LiveChatWidget } from "@/components/messaging/live-chat-widget";
import { getPortalBranding } from "@/lib/actions/portal-branding";

export const dynamic = "force-dynamic";

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

  const [{ data: profile }, branding] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, organization_id, name, avatar_url, email, role")
      .eq("id", user.id)
      .single(),
    getPortalBranding(),
  ]);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar profile={profile} branding={branding} />

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <DashboardTopbar user={{ email: user.email }} profile={profile} />
        <main className="p-6 flex-1 overflow-auto">{children}</main>
      </div>

      <LiveChatWidget />
    </div>
  );
}
