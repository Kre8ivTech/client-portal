import { describe, it, expect } from "vitest";
import { getActiveNavHref } from "@/lib/navigation/get-active-nav-href";

describe("getActiveNavHref", () => {
  it("returns the most specific (longest) matching href", () => {
    const hrefs = ["/dashboard/settings", "/dashboard/settings/white-label"];
    expect(getActiveNavHref("/dashboard/settings/white-label", hrefs)).toBe(
      "/dashboard/settings/white-label",
    );
  });

  it("matches a parent href for nested routes when no more specific match exists", () => {
    const hrefs = ["/dashboard/tickets", "/dashboard/settings"];
    expect(getActiveNavHref("/dashboard/tickets/123", hrefs)).toBe("/dashboard/tickets");
  });

  it("treats /dashboard as exact-only", () => {
    const hrefs = ["/dashboard", "/dashboard/tickets"];
    expect(getActiveNavHref("/dashboard/tickets", hrefs)).toBe("/dashboard/tickets");
  });
});

