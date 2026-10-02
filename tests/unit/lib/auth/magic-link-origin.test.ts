import { describe, expect, it } from "vitest";
import { magicLinkCallbackUrl } from "@/lib/auth/magic-link-origin";

const platform = "https://clients.kre8ivtech.com";

describe("magicLinkCallbackUrl", () => {
  it("uses the verified partner host", () => {
    expect(
      magicLinkCallbackUrl({
        requestHost: "portal.embark-marketing.com",
        configuredAppUrl: platform,
        verifiedCustomDomain: true,
      }),
    ).toBe("https://portal.embark-marketing.com/auth/callback");
  });

  it("uses the platform host for the shared portal", () => {
    expect(
      magicLinkCallbackUrl({
        requestHost: "clients.kre8ivtech.com",
        configuredAppUrl: `${platform}/`,
        verifiedCustomDomain: false,
      }),
    ).toBe("https://clients.kre8ivtech.com/auth/callback");
  });

  it("replaces the container bind address with the platform origin", () => {
    expect(
      magicLinkCallbackUrl({
        requestHost: "0.0.0.0:3000",
        configuredAppUrl: platform,
        verifiedCustomDomain: false,
      }),
    ).toBe("https://clients.kre8ivtech.com/auth/callback");
  });

  it("ignores an unverified host", () => {
    expect(
      magicLinkCallbackUrl({
        requestHost: "evil.example",
        configuredAppUrl: platform,
        verifiedCustomDomain: false,
      }),
    ).toBe("https://clients.kre8ivtech.com/auth/callback");
  });

  it("keeps a local dev callback", () => {
    expect(
      magicLinkCallbackUrl({
        requestHost: "localhost:3000",
        configuredAppUrl: platform,
        verifiedCustomDomain: false,
      }),
    ).toBe("http://localhost:3000/auth/callback");
  });
});
