'use client'

import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { User, Bell, Shield, Camera, Mail } from "lucide-react";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordChangeForm } from "@/components/profile/password-change-form";
import { EmailChangeForm } from "@/components/profile/email-change-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { useState, useEffect } from "react";

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      setUser(authUser)

      const [
        { data: userData },
        { data: profileData },
      ] = await Promise.all([
        (supabase as any).from("users").select("id, email, role").eq("id", authUser.id).single(),
        (supabase as any).from("user_profiles").select("id, name, avatar_url, organization_name, organization_slug").eq("id", authUser.id).single(),
      ])
      
      const userRow = userData as { id: string; email: string; role: string } | null
      const profileRow = profileData as { id: string; name: string | null; avatar_url: string | null; organization_name: string | null; organization_slug: string | null } | null
      
      if (userRow && profileRow) {
        setProfile({
          id: userRow.id,
          email: userRow.email,
          role: userRow.role,
          name: profileRow.name,
          avatar_url: profileRow.avatar_url,
          organization_name: profileRow.organization_name,
          organization_slug: profileRow.organization_slug,
        })
      }
    }
    loadProfile()
  }, [supabase])

  if (!user) return null

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 border-b pb-4">
          My Account
        </h2>
        <p className="text-slate-500 mt-2">
          Manage your personal information and account preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info Section - Full Width */}
        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm lg:col-span-2">
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
              <AvatarUpload 
                userId={user.id} 
                currentAvatarUrl={profile?.avatar_url} 
                fallbackChar={user?.email?.charAt(0).toUpperCase() || 'U'} 
              />
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

        {/* Notifications Section */}
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

        {/* Security Section - Email */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Mail className="text-primary w-5 h-5" />
              Change Email Address
            </CardTitle>
            <CardDescription>
              Update your email address. You&apos;ll need to verify the new email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmailChangeForm currentEmail={user?.email || ''} role={profile?.role} />
          </CardContent>
        </Card>

        {/* Security Section - Password */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield className="text-primary w-5 h-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>

        {/* 2FA Placeholder */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Shield className="text-primary w-5 h-5" />
              Two-Factor Authentication
            </CardTitle>
            <CardDescription>
              Add an extra layer of security to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Status: Disabled</h4>
                <p className="text-xs text-slate-500">Enable 2FA for enhanced security</p>
              </div>
              <button className="text-sm text-primary hover:underline font-medium" disabled>
                Coming Soon
              </button>
            </div>
          </CardContent>
        </Card>
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
          aria-label={`Enable ${title}`}
          title={`Enable ${title}`}
        />
      </div>
    </div>
  );
}
