export type GoogleAdsAccount = {
  customerId: string;
  loginCustomerId: string | null;
  name: string;
  currencyCode: string;
  timeZone: string;
  manager: boolean;
};

export type GoogleAdsCampaign = {
  id: string;
  name: string;
  status: string;
  channelType: string;
  optimizationScore: number | null;
  budgetMicros: number;
  costMicros: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export type GoogleAdsIssue = {
  id: string;
  severity: "critical" | "warning" | "info";
  type: "policy" | "delivery" | "recommendation" | "sync";
  title: string;
  detail: string;
  campaignId: string | null;
  campaignName: string | null;
};

export type GoogleAdsDailyMetric = {
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionValue: number;
};

export type GoogleAdsSnapshot = {
  dailyMetrics: GoogleAdsDailyMetric[];
  campaigns: GoogleAdsCampaign[];
  issues: GoogleAdsIssue[];
};

export type GoogleAdsConnectionRecord = {
  id: string;
  organization_id: string;
  connected_by: string;
  google_email: string | null;
  refresh_token_encrypted: string;
  refresh_token_iv: string;
  refresh_token_auth_tag: string;
  refresh_token_salt: string;
  scopes: string[];
  available_customers: GoogleAdsAccount[];
  customer_id: string | null;
  login_customer_id: string | null;
  customer_name: string | null;
  currency_code: string | null;
  time_zone: string | null;
  status: "active" | "error" | "revoked";
  last_sync_at: string | null;
  last_error: string | null;
};
