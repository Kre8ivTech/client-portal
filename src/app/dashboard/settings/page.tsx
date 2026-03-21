import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { CalendarOfficeHours } from "@/components/settings/calendar-office-hours";
import { AdminAccessInfo } from "@/components/settings/admin-access-info";
import { GeneralPreferences } from "@/components/settings/general-preferences";
import { getAppSettings } from "@/lib/actions/app-settings";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Try to fetch user data including timezone (may not exist if migration pending)
  let userData: any = null;
  let userTimezone: string | null = null;

  // First try with timezone column
  const { data: userDataWithTz, error: tzError } = await supabase
    .from("users")
    .select("id, role, organization_id, timezone")
    .eq("id", user.id)
    .single();

  if (tzError && tzError.message?.includes("timezone")) {
    // Timezone column doesn't exist yet, fetch without it
    const { data: userDataBasic } = await supabase
      .from("users")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();
    userData = userDataBasic;
  } else {
    userData = userDataWithTz;
    userTimezone = (userDataWithTz as any)?.timezone ?? null;
  }

  const userRow = userData as {
    id: string;
    role: string;
    organization_id: string | null;
  } | null;
  const role = userRow?.role ?? "client";
  const isStaffOrAdmin = role === "staff" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const appSettings = await getAppSettings();

  const { data: oauthCalendarRows } = await supabase
    .from("oauth_integrations")
    .select("id, provider, provider_email, status")
    .eq("user_id", user.id)
    .in("provider", ["google_calendar", "microsoft_outlook", "apple_caldav"]);

  const googleOAuthConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const microsoftOAuthConfigured = !!(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
  );

  const oauthErrorMessage = (code: string | undefined) => {
    if (!code) return "Calendar connection failed.";
    const map: Record<string, string> = {
      missing_params: "OAuth callback missing parameters. Try connecting again.",
      invalid_state: "Invalid or tampered OAuth state. Try connecting again.",
      state_expired: "Connection timed out. Try connecting again.",
      unauthorized: "Session mismatch. Sign in and try again.",
      oauth_not_configured: "Server is missing Google or Microsoft OAuth credentials.",
      token_exchange_failed: "Could not exchange authorization code. Check client secret and redirect URI.",
      save_failed: "Could not save the connection. Try again or contact support.",
      oauth_failed: "OAuth failed unexpectedly.",
    };
    return map[code] ?? code;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight border-b pb-4">General Settings</h2>
        <p className="text-muted-foreground mt-2">Manage your general account and system settings.</p>
      </div>

      {params.success === "google_connected" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Google Calendar connected. Your calendar will be used for capacity-related features.
          </AlertDescription>
        </Alert>
      )}
      {params.success === "microsoft_connected" && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Microsoft Outlook connected. Your calendar will be used for capacity-related features.
          </AlertDescription>
        </Alert>
      )}
      {params.error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">{oauthErrorMessage(params.error)}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8">
        {/* Admin: how admin login works */}
        {isSuperAdmin && <AdminAccessInfo />}

        {/* Calendar & Office Hours - Staff/Admin only */}
        {isStaffOrAdmin && (
          <CalendarOfficeHours
            profileId={user.id}
            oauthIntegrations={oauthCalendarRows ?? []}
            googleOAuthConfigured={googleOAuthConfigured}
            microsoftOAuthConfigured={microsoftOAuthConfigured}
          />
        )}

        {/* General preferences */}
        <GeneralPreferences
          initialTimezone={appSettings.timezone}
          userTimezone={userTimezone}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </div>
  );
}
