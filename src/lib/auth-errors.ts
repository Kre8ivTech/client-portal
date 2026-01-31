/**
 * Map Supabase auth errors to user-friendly messages.
 * Handles rate limits, invalid email, etc.
 */
export function getAuthErrorMessage(error: { message?: string; status?: number } | null): string {
  if (!error?.message) return "An unexpected error occurred. Please try again.";
  const msg = error.message.toLowerCase();
  if (
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("too many") ||
    error.status === 429
  ) {
    return "Too many sign-in emails sent. Please wait a few minutes and try again.";
  }
  if (msg.includes("invalid") && msg.includes("email")) {
    return "Please enter a valid email address.";
  }
  if (msg.includes("signup") && msg.includes("disabled")) {
    return "New sign-ups are currently disabled.";
  }
  return error.message;
}
