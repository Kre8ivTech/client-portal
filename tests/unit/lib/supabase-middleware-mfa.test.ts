import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatorAssuranceLevel: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
      },
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue(
            table === "users"
              ? {
                  data: {
                    role: "partner",
                    organization_id: "org-1",
                    status: "active",
                    mfa_enabled: true,
                  },
                  error: null,
                }
              : {
                  data: { status: "active", settings: {} },
                  error: null,
                },
          ),
        })),
      })),
    })),
    rpc: vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: {
          mfa_enabled: true,
          mfa_required_for_staff: true,
          mfa_required_for_clients: false,
        },
        error: null,
      }),
    })),
  })),
}));

import { updateSession } from "@/lib/supabase/middleware";

describe("MFA middleware routing", () => {
  beforeEach(() => {
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    });
  });

  it("sends an AAL1 dashboard session to the MFA login challenge", async () => {
    const response = await updateSession(new NextRequest("https://portal.test/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://portal.test/login?mfa_required=1");
  });

  it("allows the login page to render for an AAL1 MFA session", async () => {
    const response = await updateSession(
      new NextRequest("https://portal.test/login?mfa_required=1"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
