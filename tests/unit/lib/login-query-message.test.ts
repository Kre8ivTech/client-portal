import { describe, expect, it } from "vitest";
import { getLoginQueryMessage } from "@/lib/auth/login-query-message";

describe("getLoginQueryMessage", () => {
  it("explains inactive accounts and organizations", () => {
    expect(getLoginQueryMessage(new URLSearchParams("account_inactive=1"))).toEqual({
      type: "error",
      text: "This account is inactive or suspended. Contact your administrator to restore access.",
    });
    expect(getLoginQueryMessage(new URLSearchParams("organization_inactive=1"))).toEqual({
      type: "error",
      text: "Your organization is inactive or suspended. Contact support to restore access.",
    });
  });

  it("keeps existing login redirect messages", () => {
    expect(getLoginQueryMessage(new URLSearchParams("error=auth_callback_failed"))?.type).toBe("error");
    expect(getLoginQueryMessage(new URLSearchParams("session_expired=1"))?.text).toMatch(/session expired/i);
    expect(getLoginQueryMessage(new URLSearchParams("security_error=1"))?.text).toMatch(/security settings/i);
  });

  it("returns null when there is no login notice", () => {
    expect(getLoginQueryMessage(new URLSearchParams(""))).toBeNull();
  });
});
