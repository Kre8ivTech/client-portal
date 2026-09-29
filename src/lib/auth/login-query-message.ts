export type LoginQueryMessage = {
  type: "success" | "error";
  text: string;
};

type QueryLike = {
  get(name: string): string | null;
};

/**
 * Messages for redirects that land back on the login screen.
 * MFA challenge setup is handled separately because it loads a factor.
 */
export function getLoginQueryMessage(params: QueryLike): LoginQueryMessage | null {
  if (params.get("error") === "auth_callback_failed") {
    return {
      type: "error",
      text: "Authentication failed. Please ensure the callback URL is configured correctly.",
    };
  }

  if (params.get("account_inactive") === "1") {
    return {
      type: "error",
      text: "This account is inactive or suspended. Contact your administrator to restore access.",
    };
  }

  if (params.get("organization_inactive") === "1") {
    return {
      type: "error",
      text: "Your organization is inactive or suspended. Contact support to restore access.",
    };
  }

  if (params.get("session_expired") === "1") {
    return {
      type: "error",
      text: "Your session expired due to inactivity. Please sign in again.",
    };
  }

  if (params.get("security_error") === "1") {
    return {
      type: "error",
      text: "We could not verify your session security settings. Please sign in again. If this keeps happening, contact support.",
    };
  }

  return null;
}
