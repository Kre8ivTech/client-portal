import type { SupabaseClient } from "@supabase/supabase-js";

const OAUTH_TO_STAFF: Record<
  "google_calendar" | "microsoft_outlook" | "apple_caldav",
  "google" | "microsoft" | "ical"
> = {
  google_calendar: "google",
  microsoft_outlook: "microsoft",
  apple_caldav: "ical",
};

/**
 * Mirror OAuth calendar connections into `staff_calendar_integrations` so capacity
 * and settings UIs that read that table stay in sync with `oauth_integrations`.
 */
export async function syncStaffCalendarFromOAuth(
  supabase: SupabaseClient,
  userId: string,
  oauthProvider: keyof typeof OAUTH_TO_STAFF,
  calendarLabel: string
): Promise<{ error: Error | null }> {
  const staffProvider = OAUTH_TO_STAFF[oauthProvider];
  const { error } = await supabase.from("staff_calendar_integrations").upsert(
    {
      user_id: userId,
      provider: staffProvider,
      calendar_name: calendarLabel,
      external_calendar_id: "primary",
      sync_enabled: true,
    },
    { onConflict: "user_id,provider" }
  );
  return { error: error as Error | null };
}

export async function clearStaffCalendarFromOAuth(
  supabase: SupabaseClient,
  userId: string,
  oauthProvider: keyof typeof OAUTH_TO_STAFF
): Promise<{ error: Error | null }> {
  const staffProvider = OAUTH_TO_STAFF[oauthProvider];
  const { error } = await supabase
    .from("staff_calendar_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", staffProvider);
  return { error: error as Error | null };
}
