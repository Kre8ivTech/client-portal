import { describe, expect, it } from "vitest";
import { resolveWhiteLabelBranding, type PortalBranding } from "@/lib/white-label/resolve-branding";

const base: PortalBranding = {
  app_name: "KT-Portal",
  tagline: "Client Portal",
  logo_url: null,
  primary_color: "231 48% 58%",
  favicon_url: null,
  login_bg_color: null,
  login_bg_image_url: null,
  login_bg_overlay_opacity: 0.5,
};

describe("resolveWhiteLabelBranding", () => {
  it("keeps platform branding for direct accounts", () => {
    expect(resolveWhiteLabelBranding(base, null, null)).toEqual(base);
  });

  it("uses the partner brand for a signed-in partner or their client", () => {
    const branded = resolveWhiteLabelBranding(base, null, {
      orgName: "Northwind",
      brandingConfig: {
        app_name: "Northwind Portal",
        tagline: "Client desk",
        primary_color: "#0f766e",
      },
    });

    expect(branded.app_name).toBe("Northwind Portal");
    expect(branded.tagline).toBe("Client desk");
    expect(branded.primary_color).toBe("175 77% 26%");
  });

  it("falls back to the partner organization name before a portal name is saved", () => {
    const branded = resolveWhiteLabelBranding(base, null, {
      orgName: "Northwind",
      brandingConfig: {},
    });

    expect(branded.app_name).toBe("Northwind");
    expect(branded.tagline).toBe("Northwind Client Portal");
  });

  it("lets a verified custom domain override the signed-in account", () => {
    const branded = resolveWhiteLabelBranding(
      base,
      {
        orgName: "Host Agency",
        brandingConfig: { app_name: "Host Portal" },
      },
      {
        orgName: "Session Agency",
        brandingConfig: { app_name: "Session Portal" },
      },
    );

    expect(branded.app_name).toBe("Host Portal");
  });
});
