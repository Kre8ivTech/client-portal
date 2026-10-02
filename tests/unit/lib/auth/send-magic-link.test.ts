import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const generateLink = vi.fn();
  const createUser = vi.fn();
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return {
    maybeSingle,
    generateLink,
    createUser,
    chain,
    sendRawEmail: vi.fn(),
    getPortalBranding: vi.fn(),
    getAuthSettings: vi.fn(),
    verifyRecaptcha: vi.fn(),
    headers: vi.fn(),
  };
});

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => mocks.chain,
    auth: { admin: { generateLink: mocks.generateLink, createUser: mocks.createUser } },
  }),
}));

vi.mock("@/lib/notifications/providers/email", () => ({
  sendRawEmail: mocks.sendRawEmail,
}));

vi.mock("@/lib/actions/portal-branding", () => ({
  getPortalBranding: mocks.getPortalBranding,
}));

vi.mock("@/lib/actions/auth-settings", () => ({
  getAuthSettings: mocks.getAuthSettings,
  verifyRecaptcha: mocks.verifyRecaptcha,
}));

import { requestMagicLink } from "@/lib/actions/send-magic-link";

const embarkLogo =
  "https://www.embark-marketing.com/wp-content/uploads/2025/05/Embark-Marketing-web-logo-small.png";

function headerMap(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name] ?? null;
    },
  };
}

describe("requestMagicLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clients.kre8ivtech.com");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    mocks.getAuthSettings.mockResolvedValue({ recaptcha_enabled: false });
    mocks.sendRawEmail.mockResolvedValue({ success: true, provider: "resend" });
    mocks.generateLink.mockResolvedValue({
      data: {
        properties: {
          hashed_token: "hashed-token",
          verification_type: "magiclink",
        },
      },
      error: null,
    });
    mocks.createUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  it("sends an Embark-branded message that returns to the Embark callback", async () => {
    mocks.headers.mockResolvedValue(headerMap({ "x-forwarded-host": "portal.embark-marketing.com" }));
    mocks.maybeSingle.mockResolvedValue({ data: { id: "partner-1" }, error: null });
    mocks.getPortalBranding.mockResolvedValue({
      app_name: "Embark Marketing",
      tagline: "Portal",
      logo_url: embarkLogo,
      primary_color: "#5E2162",
      favicon_url: null,
      login_bg_color: "#5E2162",
      login_bg_image_url: null,
      login_bg_overlay_opacity: 0.4,
    });

    const result = await requestMagicLink({ email: "Person@Embark-Marketing.com" });

    expect(result).toEqual({ ok: true });
    expect(mocks.verifyRecaptcha).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
    expect(mocks.generateLink).toHaveBeenCalledWith({
      type: "magiclink",
      email: "person@embark-marketing.com",
      options: { redirectTo: "https://portal.embark-marketing.com/auth/callback" },
    });
    expect(mocks.sendRawEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "person@embark-marketing.com",
        subject: "Sign in to Embark Marketing",
        fromName: "Embark Marketing",
        organizationId: "partner-1",
      }),
    );
    const html = mocks.sendRawEmail.mock.calls[0][0].html as string;
    expect(html).toContain(embarkLogo);
    expect(html).toContain("portal.embark-marketing.com%2Fauth%2Fcallback");
    expect(html).not.toContain("0.0.0.0");
    expect(mocks.sendRawEmail.mock.calls[0][0].text).toContain(
      "redirect_to=https%3A%2F%2Fportal.embark-marketing.com%2Fauth%2Fcallback",
    );
  });

  it("sends the platform fallback for the shared portal host", async () => {
    mocks.headers.mockResolvedValue(headerMap({ host: "clients.kre8ivtech.com" }));
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.getPortalBranding.mockResolvedValue({
      app_name: "KT-Portal",
      tagline: "Client Portal",
      logo_url: null,
      primary_color: "231 48% 58%",
      favicon_url: null,
      login_bg_color: null,
      login_bg_image_url: null,
      login_bg_overlay_opacity: 0.5,
    });

    const result = await requestMagicLink({ email: "client@example.com" });

    expect(result).toEqual({ ok: true });
    expect(mocks.generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { redirectTo: "https://clients.kre8ivtech.com/auth/callback" },
      }),
    );
    const payload = mocks.sendRawEmail.mock.calls[0][0];
    expect(payload.subject).toBe("Sign in to KT-Portal");
    expect(payload.fromName).toBe("KT-Portal");
    expect(payload.organizationId).toBeNull();
    expect(payload.html).not.toContain("<img");
    expect(payload.html).toContain("clients.kre8ivtech.com%2Fauth%2Fcallback");
    expect(payload.html).not.toContain("portal.embark-marketing.com");
  });

  it("creates a passwordless user when no account exists and still does not return the link", async () => {
    mocks.headers.mockResolvedValue(headerMap({ "x-forwarded-host": "0.0.0.0:3000" }));
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.getPortalBranding.mockResolvedValue({
      app_name: "Kre8ivTech Portal",
      tagline: "Client Portal",
      logo_url: "https://cdn.example.com/kre8ivtech-logo.png",
      primary_color: "#1d4ed8",
      favicon_url: null,
      login_bg_color: null,
      login_bg_image_url: null,
      login_bg_overlay_opacity: 0.5,
    });
    mocks.generateLink
      .mockResolvedValueOnce({ data: null, error: { message: "User not found", code: "user_not_found" } })
      .mockResolvedValueOnce({
        data: { properties: { hashed_token: "hashed-token", verification_type: "magiclink" } },
        error: null,
      });

    const result = await requestMagicLink({ email: "new-user@example.com" });

    expect(result).toEqual({ ok: true });
    expect(mocks.createUser).toHaveBeenCalledWith({
      email: "new-user@example.com",
      email_confirm: true,
    });
    expect(mocks.generateLink).toHaveBeenLastCalledWith(
      expect.objectContaining({
        options: { redirectTo: "https://clients.kre8ivtech.com/auth/callback" },
      }),
    );
    expect(JSON.stringify(result)).not.toContain("hashed-token");
    expect(mocks.sendRawEmail.mock.calls[0][0].subject).toBe("Sign in to Kre8ivTech Portal");
    expect(mocks.sendRawEmail.mock.calls[0][0].html).toContain("https://cdn.example.com/kre8ivtech-logo.png");
  });
});
