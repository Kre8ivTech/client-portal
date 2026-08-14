import { z } from "zod";

import type {
  GoogleAdsAccount,
  GoogleAdsCampaign,
  GoogleAdsDailyMetric,
  GoogleAdsIssue,
  GoogleAdsSnapshot,
} from "@/lib/google-ads/types";

const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
const DEFAULT_API_VERSION = "v25";
const REQUEST_TIMEOUT_MS = 30_000;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});

const userInfoSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().optional(),
});

const accessibleCustomersSchema = z.object({
  resourceNames: z.array(z.string()).default([]),
});

const searchStreamSchema = z.array(
  z.object({
    results: z.array(z.record(z.unknown())).optional(),
  }),
);

export const GOOGLE_ADS_OAUTH_SCOPES = [
  GOOGLE_ADS_SCOPE,
  "https://www.googleapis.com/auth/userinfo.email",
];

export class GoogleAdsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly requestId: string | null,
  ) {
    super(message);
    this.name = "GoogleAdsApiError";
  }
}

function getApiVersion(): string {
  const configured = process.env.GOOGLE_ADS_API_VERSION?.trim();
  return configured && /^v\d+$/.test(configured) ? configured : DEFAULT_API_VERSION;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Google Ads reporting`);
  return value;
}

export function getGoogleAdsOAuthConfig() {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    developerToken: requireEnv("GOOGLE_ADS_DEVELOPER_TOKEN"),
    apiVersion: getApiVersion(),
  };
}

function tokenEndpointBody(values: Record<string, string>) {
  return new URLSearchParams(values);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new GoogleAdsApiError(
      "Google returned an unreadable response",
      response.status,
      response.headers.get("request-id"),
    );
  }
}

export async function exchangeGoogleAdsCode(input: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = getGoogleAdsOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenEndpointBody({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new GoogleAdsApiError("Google authorization code exchange failed", response.status, null);
  }
  return tokenResponseSchema.parse(payload);
}

export async function refreshGoogleAdsAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getGoogleAdsOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenEndpointBody({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new GoogleAdsApiError("Google access token refresh failed", response.status, null);
  }
  return tokenResponseSchema.parse(payload).access_token;
}

export async function getGoogleAdsUserEmail(accessToken: string): Promise<string | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok) return null;
  return userInfoSchema.parse(payload).email ?? null;
}

export async function revokeGoogleAdsToken(refreshToken: string): Promise<void> {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenEndpointBody({ token: refreshToken }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function googleAdsRequest(
  path: string,
  accessToken: string,
  init: RequestInit = {},
  loginCustomerId?: string | null,
): Promise<unknown> {
  const { developerToken, apiVersion } = getGoogleAdsOAuthConfig();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("developer-token", developerToken);
  headers.set("Content-Type", "application/json");
  if (loginCustomerId) headers.set("login-customer-id", loginCustomerId);

  const response = await fetch(`https://googleads.googleapis.com/${apiVersion}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw new GoogleAdsApiError(
      `Google Ads request failed (${response.status})`,
      response.status,
      response.headers.get("request-id"),
    );
  }
  return payload;
}

async function googleAdsSearch(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId?: string | null,
): Promise<Record<string, unknown>[]> {
  const payload = await googleAdsRequest(
    `/customers/${customerId}/googleAds:searchStream`,
    accessToken,
    { method: "POST", body: JSON.stringify({ query }) },
    loginCustomerId,
  );
  return searchStreamSchema
    .parse(payload)
    .flatMap((batch) => batch.results ?? []);
}

function customerIdFromResource(resourceName: string): string | null {
  const match = /^customers\/(\d{10})$/.exec(resourceName);
  return match?.[1] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function prettifyEnum(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toAccount(customer: Record<string, unknown>, loginCustomerId: string | null): GoogleAdsAccount {
  const id = asString(customer.id).replace(/\D/g, "");
  return {
    customerId: id,
    loginCustomerId,
    name: asString(customer.descriptiveName, `Google Ads ${id}`),
    currencyCode: asString(customer.currencyCode, "USD"),
    timeZone: asString(customer.timeZone, "UTC"),
    manager: asBoolean(customer.manager),
  };
}

export async function listGoogleAdsAccounts(accessToken: string): Promise<GoogleAdsAccount[]> {
  const payload = await googleAdsRequest("/customers:listAccessibleCustomers", accessToken, { method: "GET" });
  const resourceNames = accessibleCustomersSchema.parse(payload).resourceNames;
  const directIds = resourceNames
    .map(customerIdFromResource)
    .filter((value): value is string => Boolean(value));

  const accounts: GoogleAdsAccount[] = [];
  for (const customerId of directIds) {
    const directRows = await googleAdsSearch(
      accessToken,
      customerId,
      "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1",
    );
    const directCustomer = asRecord(directRows[0]?.customer);
    const directAccount = toAccount(directCustomer, null);

    if (!directAccount.manager) {
      accounts.push(directAccount);
      continue;
    }

    const childRows = await googleAdsSearch(
      accessToken,
      customerId,
      "SELECT customer_client.client_customer, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.status, customer_client.level FROM customer_client WHERE customer_client.level > 0 AND customer_client.status = 'ENABLED'",
      customerId,
    );
    for (const row of childRows) {
      const child = asRecord(row.customerClient);
      if (asBoolean(child.manager)) continue;
      const childId = customerIdFromResource(asString(child.clientCustomer));
      if (!childId) continue;
      accounts.push(
        toAccount(
          {
            id: childId,
            descriptiveName: child.descriptiveName,
            currencyCode: child.currencyCode,
            timeZone: child.timeZone,
            manager: false,
          },
          customerId,
        ),
      );
    }
  }

  return Array.from(new Map(accounts.map((account) => [account.customerId, account])).values())
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function currentDateInTimeZone(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function parseDailyMetrics(rows: Record<string, unknown>[]): GoogleAdsDailyMetric[] {
  return rows.map((row) => {
    const segments = asRecord(row.segments);
    const metrics = asRecord(row.metrics);
    return {
      date: asString(segments.date),
      impressions: asNumber(metrics.impressions),
      clicks: asNumber(metrics.clicks),
      costMicros: asNumber(metrics.costMicros),
      conversions: asNumber(metrics.conversions),
      conversionValue: asNumber(metrics.conversionsValue),
    };
  }).filter((metric) => /^\d{4}-\d{2}-\d{2}$/.test(metric.date));
}

function parseCampaigns(rows: Record<string, unknown>[]): GoogleAdsCampaign[] {
  return rows.map((row) => {
    const campaign = asRecord(row.campaign);
    const budget = asRecord(row.campaignBudget);
    const metrics = asRecord(row.metrics);
    const rawScore = campaign.optimizationScore;
    return {
      id: asString(campaign.id),
      name: asString(campaign.name, "Unnamed campaign"),
      status: asString(campaign.status, "UNKNOWN"),
      channelType: asString(campaign.advertisingChannelType, "UNKNOWN"),
      optimizationScore: rawScore === null || rawScore === undefined ? null : asNumber(rawScore),
      budgetMicros: asNumber(budget.amountMicros),
      costMicros: asNumber(metrics.costMicros),
      impressions: asNumber(metrics.impressions),
      clicks: asNumber(metrics.clicks),
      conversions: asNumber(metrics.conversions),
    };
  });
}

function buildDeliveryIssues(rows: Record<string, unknown>[]): GoogleAdsIssue[] {
  return rows.flatMap((row) => {
    const campaign = asRecord(row.campaign);
    const status = asString(campaign.status);
    const primaryStatus = asString(campaign.primaryStatus);
    const reasons = Array.isArray(campaign.primaryStatusReasons)
      ? campaign.primaryStatusReasons.filter((value): value is string => typeof value === "string")
      : [];
    if (status !== "ENABLED" || primaryStatus === "ELIGIBLE" || reasons.length === 0) return [];
    return [{
      id: `delivery-${asString(campaign.id)}`,
      severity: "warning" as const,
      type: "delivery" as const,
      title: `${asString(campaign.name, "Campaign")} has limited delivery`,
      detail: reasons.map(prettifyEnum).join(", "),
      campaignId: asString(campaign.id) || null,
      campaignName: asString(campaign.name) || null,
    }];
  });
}

function buildPolicyIssues(rows: Record<string, unknown>[]): GoogleAdsIssue[] {
  return rows.flatMap((row) => {
    const campaign = asRecord(row.campaign);
    const adGroupAd = asRecord(row.adGroupAd);
    const ad = asRecord(adGroupAd.ad);
    const policy = asRecord(adGroupAd.policySummary);
    const approvalStatus = asString(policy.approvalStatus);
    if (!approvalStatus || approvalStatus === "APPROVED") return [];
    return [{
      id: `policy-${asString(ad.id)}`,
      severity: approvalStatus === "DISAPPROVED" ? "critical" as const : "warning" as const,
      type: "policy" as const,
      title: `Ad ${prettifyEnum(approvalStatus)}`,
      detail: "Review this ad's Google policy details and request a review after correcting the issue.",
      campaignId: asString(campaign.id) || null,
      campaignName: asString(campaign.name) || null,
    }];
  });
}

function buildRecommendationIssues(rows: Record<string, unknown>[]): GoogleAdsIssue[] {
  return rows.slice(0, 20).map((row, index) => {
    const recommendation = asRecord(row.recommendation);
    const type = asString(recommendation.type, "OTHER");
    return {
      id: `recommendation-${asString(recommendation.resourceName, String(index))}`,
      severity: "info" as const,
      type: "recommendation" as const,
      title: prettifyEnum(type),
      detail: "Google Ads has an optimization recommendation available for this account.",
      campaignId: null,
      campaignName: null,
    };
  });
}

async function optionalSearch(
  accessToken: string,
  customerId: string,
  query: string,
  loginCustomerId: string | null,
): Promise<{ rows: Record<string, unknown>[]; failed: boolean }> {
  try {
    return {
      rows: await googleAdsSearch(accessToken, customerId, query, loginCustomerId),
      failed: false,
    };
  } catch {
    return { rows: [], failed: true };
  }
}

export async function fetchGoogleAdsSnapshot(input: {
  accessToken: string;
  customerId: string;
  loginCustomerId: string | null;
  timeZone: string;
}): Promise<GoogleAdsSnapshot> {
  const today = currentDateInTimeZone(input.timeZone);
  const dailyRows = await googleAdsSearch(
    input.accessToken,
    input.customerId,
    "SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date DURING LAST_30_DAYS ORDER BY segments.date",
    input.loginCustomerId,
  );

  const [campaignResult, deliveryResult, policyResult, recommendationResult] = await Promise.all([
    optionalSearch(
      input.accessToken,
      input.customerId,
      `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.optimization_score, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM campaign WHERE segments.date = '${today}' AND campaign.status != 'REMOVED'`,
      input.loginCustomerId,
    ),
    optionalSearch(
      input.accessToken,
      input.customerId,
      "SELECT campaign.id, campaign.name, campaign.status, campaign.primary_status, campaign.primary_status_reasons FROM campaign WHERE campaign.status = 'ENABLED'",
      input.loginCustomerId,
    ),
    optionalSearch(
      input.accessToken,
      input.customerId,
      "SELECT campaign.id, campaign.name, ad_group_ad.ad.id, ad_group_ad.policy_summary.approval_status FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED' AND ad_group_ad.policy_summary.approval_status != 'APPROVED' LIMIT 100",
      input.loginCustomerId,
    ),
    optionalSearch(
      input.accessToken,
      input.customerId,
      "SELECT recommendation.resource_name, recommendation.type FROM recommendation WHERE recommendation.dismissed = FALSE LIMIT 50",
      input.loginCustomerId,
    ),
  ]);

  const healthChecksIncomplete = policyResult.failed || deliveryResult.failed || recommendationResult.failed;
  const syncIssues: GoogleAdsIssue[] = healthChecksIncomplete
    ? [{
        id: `sync-health-${today}`,
        severity: "warning",
        type: "sync",
        title: "Some account health checks were unavailable",
        detail: "Performance data synced, but Google did not return every policy, delivery, or recommendation check.",
        campaignId: null,
        campaignName: null,
      }]
    : [];

  return {
    dailyMetrics: parseDailyMetrics(dailyRows),
    campaigns: parseCampaigns(campaignResult.rows),
    issues: [
      ...buildPolicyIssues(policyResult.rows),
      ...buildDeliveryIssues(deliveryResult.rows),
      ...buildRecommendationIssues(recommendationResult.rows),
      ...syncIssues,
    ],
  };
}
