import { describe, expect, it } from "vitest";
import { buildMagicLinkEmail } from "@/lib/auth/magic-link-email";
import type { MagicLinkEmailBranding } from "@/lib/auth/magic-link-email";

const embarkLogo =
  "https://www.embark-marketing.com/wp-content/uploads/2025/05/Embark-Marketing-web-logo-small.png";

const embarkLink =
  "https://example.supabase.co/auth/v1/verify?token=abc&type=magiclink&redirect_to=" +
  encodeURIComponent("https://portal.embark-marketing.com/auth/callback");

const platformLink =
  "https://example.supabase.co/auth/v1/verify?token=abc&type=magiclink&redirect_to=" +
  encodeURIComponent("https://clients.kre8ivtech.com/auth/callback");

const embarkBranding: MagicLinkEmailBranding = {
  app_name: "Embark Marketing",
  tagline: "Portal",
  logo_url: embarkLogo,
  primary_color: "#5E2162",
};

const platformBranding: MagicLinkEmailBranding = {
  app_name: "KT-Portal",
  tagline: "Client Portal",
  logo_url: null,
  primary_color: "231 48% 58%",
};

describe("buildMagicLinkEmail", () => {
  it("brands the message for Embark", () => {
    const email = buildMagicLinkEmail({ branding: embarkBranding, magicLink: embarkLink });

    expect(email?.subject).toBe("Sign in to Embark Marketing");
    expect(email?.fromName).toBe("Embark Marketing");
    expect(email?.html).toContain(embarkLogo);
    expect(email?.html).toContain("Embark Marketing");
    expect(email?.html).toContain("Portal");
    expect(email?.html).toContain("background:#5e2162");
    expect(email?.html).toContain(">Sign in<");
    expect(email?.html).toContain("portal.embark-marketing.com%2Fauth%2Fcallback");
    expect(email?.html).not.toContain("0.0.0.0");
    expect(email?.html).not.toContain("<script");
    expect(email?.html).not.toMatch(/width=["']1["']/);
    expect(email?.text).toContain("Sign in to Embark Marketing");
    expect(email?.text).toContain("Portal");
    expect(email?.text).toContain(embarkLink);
    expect(email?.html.match(/<img /g)).toHaveLength(1);
  });

  it("uses the platform fallback when no partner logo is configured", () => {
    const email = buildMagicLinkEmail({ branding: platformBranding, magicLink: platformLink });

    expect(email?.subject).toBe("Sign in to KT-Portal");
    expect(email?.fromName).toBe("KT-Portal");
    expect(email?.html).toContain("KT-Portal");
    expect(email?.html).toContain("Client Portal");
    expect(email?.html).not.toContain("<img");
    expect(email?.html).toMatch(/background:#[0-9a-f]{6}/);
    expect(email?.html).not.toContain("231 48% 58%");
    expect(email?.html).toContain("clients.kre8ivtech.com");
    expect(email?.text).toContain(platformLink);
    expect(email?.text).toContain("If you did not request this email, you can ignore it.");
  });

  it("escapes brand strings and drops an unsafe logo", () => {
    const email = buildMagicLinkEmail({
      branding: {
        app_name: "Embark <script>alert(1)</script>\r\nBcc: evil@example.com",
        tagline: "<img src=x onerror=alert(1)>",
        logo_url: "javascript:alert(1)",
        primary_color: "not-a-color",
      },
      magicLink: embarkLink,
    });

    expect(email?.subject).toBe("Sign in to Embark <script>alert(1)</script> Bcc: evil@example.com");
    expect(email?.subject).not.toMatch(/[\r\n]/);
    expect(email?.html).not.toContain("<script");
    expect(email?.html).toContain("&lt;script&gt;");
    expect(email?.html).toContain("&lt;img");
    expect(email?.html).not.toContain("<img");
    expect(email?.html).toContain("background:#334155");
  });

  it("refuses a non-http magic link", () => {
    expect(
      buildMagicLinkEmail({ branding: embarkBranding, magicLink: "javascript:alert(1)" }),
    ).toBeNull();
  });
});
