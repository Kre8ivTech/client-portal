import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchGoogleAdsSnapshot, listGoogleAdsAccounts } from "@/lib/google-ads/client";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "request-id": "request-123" },
  });
}

describe("Google Ads REST client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("lists a directly accessible advertising account", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "developer-token");
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ resourceNames: ["customers/1234567890"] }))
      .mockResolvedValueOnce(jsonResponse([{ results: [{
        customer: {
          id: "1234567890",
          descriptiveName: "Acme Ads",
          currencyCode: "USD",
          timeZone: "America/Chicago",
          manager: false,
        },
      }] }]));

    await expect(listGoogleAdsAccounts("access-token")).resolves.toEqual([{
      customerId: "1234567890",
      loginCustomerId: null,
      name: "Acme Ads",
      currencyCode: "USD",
      timeZone: "America/Chicago",
      manager: false,
    }]);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://googleads.googleapis.com/v25/customers:listAccessibleCustomers",
      expect.objectContaining({ method: "GET" }),
    );
    const firstHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(firstHeaders.get("developer-token")).toBe("developer-token");
    expect(firstHeaders.get("authorization")).toBe("Bearer access-token");
  });

  it("parses daily performance and surfaces account health issues", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
    vi.stubEnv("GOOGLE_ADS_DEVELOPER_TOKEN", "developer-token");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) as { query?: string } : {};
      const query = body.query ?? "";
      if (query.includes("FROM customer")) {
        return jsonResponse([{ results: [{
          segments: { date: "2026-08-13" },
          metrics: { impressions: "1000", clicks: "25", costMicros: "12000000", conversions: 3, conversionsValue: 75 },
        }] }]);
      }
      if (query.includes("campaign.optimization_score")) {
        return jsonResponse([{ results: [{
          campaign: { id: "42", name: "Search", status: "ENABLED", advertisingChannelType: "SEARCH", optimizationScore: 0.88 },
          campaignBudget: { amountMicros: "50000000" },
          metrics: { impressions: "1000", clicks: "25", costMicros: "12000000", conversions: 3 },
        }] }]);
      }
      if (query.includes("campaign.primary_status")) {
        return jsonResponse([{ results: [{
          campaign: { id: "42", name: "Search", status: "ENABLED", primaryStatus: "LIMITED", primaryStatusReasons: ["BUDGET_CONSTRAINED"] },
        }] }]);
      }
      if (query.includes("ad_group_ad.policy_summary")) {
        return jsonResponse([{ results: [{
          campaign: { id: "42", name: "Search" },
          adGroupAd: { ad: { id: "99" }, policySummary: { approvalStatus: "DISAPPROVED" } },
        }] }]);
      }
      return jsonResponse([{ results: [{
        recommendation: { resourceName: "customers/123/recommendations/1", type: "CAMPAIGN_BUDGET" },
      }] }]);
    });

    const snapshot = await fetchGoogleAdsSnapshot({
      accessToken: "access-token",
      customerId: "1234567890",
      loginCustomerId: "9876543210",
      timeZone: "UTC",
    });

    expect(snapshot.dailyMetrics).toEqual([expect.objectContaining({
      date: "2026-08-13",
      impressions: 1000,
      clicks: 25,
      costMicros: 12_000_000,
    })]);
    expect(snapshot.campaigns).toEqual([expect.objectContaining({ id: "42", optimizationScore: 0.88 })]);
    expect(snapshot.issues.map((issue) => issue.type)).toEqual(["policy", "delivery", "recommendation"]);
    expect(snapshot.issues[0]).toEqual(expect.objectContaining({ severity: "critical", campaignId: "42" }));
  });
});
