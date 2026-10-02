// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  userSingle: vi.fn(),
  orgSingle: vi.fn(),
  existingMaybe: vi.fn(),
  adminUpdate: vi.fn(),
  verifyDomainCname: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table === "users") {
        return { select: () => ({ eq: () => ({ single: mocks.userSingle }) }) };
      }
      return { select: () => ({ eq: () => ({ single: mocks.orgSingle }) }) };
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () => ({ maybeSingle: mocks.existingMaybe }),
        }),
      }),
      update: (payload: unknown) => ({
        eq: () => mocks.adminUpdate(payload),
      }),
    }),
  }),
}));

vi.mock("@/lib/white-label/domain-verification", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/white-label/domain-verification")>();
  return {
    ...actual,
    verifyDomainCname: mocks.verifyDomainCname,
  };
});

import { POST } from "@/app/api/white-label/domains/verify/route";
import { normalizeCustomDomain } from "@/lib/white-label/domain-verification";

const orgId = "11111111-1111-4111-8111-111111111111";

function request(body: unknown) {
  return new NextRequest("https://clients.kre8ivtech.com/api/white-label/domains/verify", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.userSingle.mockResolvedValue({
    data: { id: "user-1", role: "partner", organization_id: orgId },
  });
  mocks.orgSingle.mockResolvedValue({
    data: {
      id: orgId,
      type: "partner",
      status: "active",
      parent_org_id: null,
      custom_domain: null,
    },
  });
  mocks.existingMaybe.mockResolvedValue({ data: null });
  mocks.adminUpdate.mockResolvedValue({ error: null });
  mocks.verifyDomainCname.mockResolvedValue({
    verified: true,
    records: ["clients.kre8ivtech.com"],
    expectedTargets: ["clients.kre8ivtech.com"],
  });
});

describe("normalizeCustomDomain", () => {
  it("accepts a hostname typed with a scheme", () => {
    expect(normalizeCustomDomain("https://Portal.Embark-Marketing.com/")).toBe(
      "portal.embark-marketing.com",
    );
  });
});

describe("POST /api/white-label/domains/verify", () => {
  it("saves the typed domain and marks it verified when the CNAME matches", async () => {
    const response = await POST(request({ organizationId: orgId, domain: "portal.embark-marketing.com" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(mocks.adminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_domain: "portal.embark-marketing.com",
        custom_domain_verified: true,
      }),
    );
  });

  it("asks for a domain when the field and the saved value are empty", async () => {
    const response = await POST(request({ organizationId: orgId }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Enter a custom domain, then verify it.");
    expect(mocks.adminUpdate).not.toHaveBeenCalled();
  });
});
