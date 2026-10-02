import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "@/components/auth/login-form";
import type { PortalBranding } from "@/lib/white-label/resolve-branding";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
      mfa: { listFactors: vi.fn() },
    },
  }),
}));

vi.mock("@/lib/actions/auth-settings", () => ({
  getAuthSettings: vi.fn().mockResolvedValue(null),
  verifyRecaptcha: vi.fn(),
}));

const embarkBranding: PortalBranding = {
  app_name: "Embark Marketing",
  tagline: "Portal",
  logo_url: "https://cdn.example.com/embark-logo.png",
  primary_color: "296 50% 26%",
  favicon_url: null,
  login_bg_color: "#5E2162",
  login_bg_image_url: null,
  login_bg_overlay_opacity: 0.4,
};

describe("LoginForm branding", () => {
  it("paints the partner brand on the first render", () => {
    const { container } = render(<LoginForm initialBranding={embarkBranding} />);

    expect(screen.getByRole("img", { name: "Embark Marketing" })).toHaveAttribute(
      "src",
      embarkBranding.logo_url,
    );
    expect(screen.getByText("Portal")).toBeInTheDocument();
    expect(screen.getByText("Embark Marketing")).toBeInTheDocument();
    expect(screen.queryByText("Client Portal")).not.toBeInTheDocument();
    expect(screen.queryByText("KT-Portal")).not.toBeInTheDocument();

    const backdrop = container.firstElementChild as HTMLElement;
    expect(backdrop.style.backgroundColor).toBe("rgb(94, 33, 98)");
    expect(backdrop.className).not.toContain("from-slate-900");
  });
});
