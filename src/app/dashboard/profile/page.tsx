import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { User, Bell, Shield, Camera } from "lucide-react";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    { data: userData },
    { data: profileData },
  ] = await Promise.all([
    supabase.from("users").select("id, email, role").eq("id", user.id).single(),
    supabase.from("user_profiles").select("id, name, avatar_url, organization_name, organization_slug").eq("id", user.id).single(),
  ]);
  const userRow = userData as { id: string; email: string; role: string } | null;
  const profileRow = profileData as { id: string; name: string | null; avatar_url: string | null; organization_name: string | null; organization_slug: string | null } | null;
  const profile =
    userRow && profileRow
      ? {
          id: userRow.id,
          email: userRow.email,
          role: userRow.role,
          name: profileRow.name,
          avatar_url: profileRow.avatar_url,
          organization_name: profileRow.organization_name,
          organization_slug: profileRow.organization_slug,
        }
      : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 border-b pb-4">
          My Account
        </h2>
        <p className="text-slate-500 mt-2">
          Manage your personal information and account preferences.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        {/* Navigation Sidebar (Local to page) */}
        <aside className="space-y-1">
          <SectionNav icon={<User size={18} />} label="Personal Info" active />
          <SectionNav icon={<Bell size={18} />} label="Notifications" />
          <SectionNav icon={<Shield size={18} />} label="Security" />
        </aside>

        <div className="space-y-8">
          {/* Avatar Section */}
          <Card className="border-slate-200 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <User className="text-primary w-5 h-5" />
                Profile Details
              </CardTitle>
              <CardDescription>
                Public information used across the portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
                <div className="relative">
                  <div className="relative h-28 w-28 rounded-full bg-slate-100 border-4 border-white shadow-xl flex items-center justify-center text-3xl font-bold text-slate-300 overflow-hidden">
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt="Avatar"
                        fill
                        className="rounded-full object-cover"
                        sizes="112px"
                      />
                    ) : (
                      user?.email?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full border-2 border-white shadow-lg hover:scale-110 transition-transform">
                    <Camera size={16} />
                  </button>
                </div>
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-bold text-slate-900">
                    {profile?.name || "Complete your profile"}
                  </h3>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                  <p className="mt-3 text-sm text-slate-600">
                    Your role:{" "}
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {formatRole(profile?.role)}
                    </span>
                  </p>
                </div>
              </div>

              <ProfileForm
                defaultName={profile?.name ?? ""}
                userEmail={user?.email ?? ""}
              />
            </CardContent>
          </Card>

          {/* Notifications Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Bell className="text-primary w-5 h-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Choose how and when you want to receive updates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <NotificationToggle
                  title="Ticket Updates"
                  description="Receive email notifications when a ticket is updated or commented on."
                  defaultChecked
                />
                <NotificationToggle
                  title="Invoice Alerts"
                  description="Get notified when a new invoice is generated or a payment is due."
                  defaultChecked
                />
                <NotificationToggle
                  title="Real-time Chat"
                  description="Enable browser notifications for new live chat messages."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatRole(role: string | null | undefined): string {
  if (!role) return "—";
  const labels: Record<string, string> = {
    super_admin: "Admin",
    staff: "Staff",
    partner: "Partner",
    partner_staff: "Partner Staff",
    client: "Client",
  };
  return labels[role] ?? role.replace(/_/g, " ");
}

function SectionNav({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-primary text-white shadow-md shadow-primary/10"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NotificationToggle({
  title,
  description,
  defaultChecked = false,
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-slate-50 last:border-0">
      <div className="space-y-0.5">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500 whitespace-normal leading-relaxed">
          {description}
        </p>
      </div>
      <div className="flex items-center h-5">
        <input
          type="checkbox"
          defaultChecked={defaultChecked}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary accent-primary"
        />
      </div>
    </div>
  );
}
