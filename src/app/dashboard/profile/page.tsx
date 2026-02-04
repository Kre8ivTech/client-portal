"use client";

import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      const [{ data: userData }, { data: profileData }] = await Promise.all([
        (supabase as any).from("users").select("id, email, role").eq("id", authUser.id).single(),
        (supabase as any)
          .from("user_profiles")
          .select("id, name, avatar_url, organization_name, organization_slug")
          .eq("id", authUser.id)
          .single(),
      ]);

      const userRow = userData as { id: string; email: string; role: string } | null;
      const profileRow = profileData as {
        id: string;
        name: string | null;
        avatar_url: string | null;
        organization_name: string | null;
        organization_slug: string | null;
      } | null;

      if (userRow && profileRow) {
        setProfile({
          id: userRow.id,
          email: userRow.email,
          role: userRow.role,
          name: profileRow.name,
          avatar_url: profileRow.avatar_url,
          organization_name: profileRow.organization_name,
          organization_slug: profileRow.organization_slug,
        });
      }
    }
    loadProfile();
  }, [supabase]);

  if (!user) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 border-b pb-4">My Account</h2>
        <p className="text-slate-500 mt-2">Manage your personal information and account preferences.</p>
      </div>

      {/* Personal Info Section */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <User className="text-primary w-5 h-5" />
            Profile Details
          </CardTitle>
          <CardDescription>Public information used across the portal.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-8 mb-8">
            <AvatarUpload
              userId={user.id}
              currentAvatarUrl={profile?.avatar_url}
              fallbackChar={user?.email?.charAt(0).toUpperCase() || "U"}
            />
            <div className="text-center sm:text-left">
              <h3 className="text-xl font-bold text-slate-900">{profile?.name || "Complete your profile"}</h3>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <p className="mt-3 text-sm text-slate-600">
                Your role:{" "}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  {formatRole(profile?.role)}
                </span>
              </p>
            </div>
          </div>

          <ProfileForm defaultName={profile?.name ?? ""} userEmail={user?.email ?? ""} />
        </CardContent>
      </Card>
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
