import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AuthSettings } from "@/components/settings/auth-settings";

export const metadata = {
  title: "Authentication Settings",
  description: "Configure SSO, MFA, and reCAPTCHA settings",
};

export default async function AuthSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is super_admin
  const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (userData?.role !== "super_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Authentication Settings</h1>
        <p className="text-muted-foreground">
          Configure single sign-on, multi-factor authentication, and bot protection.
        </p>
      </div>

      <AuthSettings />
    </div>
  );
}
