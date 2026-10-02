import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardSidebar } from "@/components/layout/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

const profile = {
  id: "test-id",
  organization_id: "org-id",
  email: "jeremiah@example.com",
  role: "partner" as const,
  is_account_manager: false,
  name: "Jeremiah Castillo",
  avatar_url: null,
  organization_name: "Embark Marketing",
  organization_slug: "embark-marketing",
};

const embarkLogo =
  "https://www.embark-marketing.com/wp-content/uploads/2025/05/Embark-Marketing-web-logo-small.png";
const platformLogo = "https://static.kre8ivtech.com/uploads/2019/11/kre8ivtech.png";

describe("DashboardSidebar logo", () => {
  it("renders a partner logo without sending the shared portal referrer", () => {
    render(
      <DashboardSidebar
        profile={profile}
        branding={{
          app_name: "Embark Marketing",
          tagline: "Client Portal",
          logo_url: embarkLogo,
        }}
      />,
    );

    const logo = screen.getByRole("img", { name: "Embark Marketing" });
    expect(logo).toHaveAttribute("src", embarkLogo);
    expect(logo).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.queryByRole("heading", { name: "Embark Marketing" })).not.toBeInTheDocument();
  });

  it("keeps the platform logo address and the same referrer policy", () => {
    render(
      <DashboardSidebar
        profile={profile}
        branding={{
          app_name: "KT-Portal",
          tagline: "Client Portal",
          logo_url: platformLogo,
        }}
      />,
    );

    const logo = screen.getByRole("img", { name: "KT-Portal" });
    expect(logo).toHaveAttribute("src", platformLogo);
    expect(logo).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("shows the app name when no logo url is set", () => {
    render(
      <DashboardSidebar
        profile={profile}
        branding={{
          app_name: "Embark Marketing",
          tagline: "Client Portal",
          logo_url: null,
        }}
      />,
    );

    expect(screen.queryByRole("img", { name: "Embark Marketing" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Embark Marketing" })).toBeInTheDocument();
  });
});
