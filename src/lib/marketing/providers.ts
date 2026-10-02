export const MARKETING_PROVIDER_IDS = [
  "google_ads",
  "ga4",
  "google_oauth",
  "search_console",
  "tag_manager",
] as const;

export type MarketingProviderId = (typeof MARKETING_PROVIDER_IDS)[number];

export type MarketingField = {
  key: string;
  label: string;
  secret: boolean;
  inputMode?: "url" | "text";
  autoComplete: "off" | "url" | "new-password";
};

export type MarketingProvider = {
  id: MarketingProviderId;
  label: string;
  description: string;
  fields: MarketingField[];
};

export const MARKETING_PROVIDERS: MarketingProvider[] = [
  {
    id: "google_ads",
    label: "Google Ads",
    description: "OAuth client and developer token for this organization's Google Ads connection.",
    fields: [
      { key: "client_id", label: "OAuth client ID", secret: false, autoComplete: "off" },
      { key: "client_secret", label: "OAuth client secret", secret: true, autoComplete: "new-password" },
      { key: "developer_token", label: "Developer token", secret: true, autoComplete: "new-password" },
    ],
  },
  {
    id: "ga4",
    label: "Google Analytics (GA4)",
    description: "Measurement ID, property ID, and Measurement Protocol secret for this organization.",
    fields: [
      { key: "measurement_id", label: "Measurement ID", secret: false, autoComplete: "off" },
      { key: "property_id", label: "Property ID", secret: false, autoComplete: "off" },
      { key: "api_secret", label: "API secret", secret: true, autoComplete: "new-password" },
    ],
  },
  {
    id: "google_oauth",
    label: "Google OAuth",
    description: "Client ID and secret for Calendar and Drive connections owned by this organization.",
    fields: [
      { key: "client_id", label: "OAuth client ID", secret: false, autoComplete: "off" },
      { key: "client_secret", label: "OAuth client secret", secret: true, autoComplete: "new-password" },
    ],
  },
  {
    id: "search_console",
    label: "Google Search Console",
    description: "Search Console property and OAuth client stored for this organization.",
    fields: [
      { key: "site_url", label: "Property URL", secret: false, inputMode: "url", autoComplete: "url" },
      { key: "client_id", label: "OAuth client ID", secret: false, autoComplete: "off" },
      { key: "client_secret", label: "OAuth client secret", secret: true, autoComplete: "new-password" },
    ],
  },
  {
    id: "tag_manager",
    label: "Google Tag Manager",
    description: "Container and account IDs for this organization's tag container.",
    fields: [
      { key: "container_id", label: "Container ID", secret: false, autoComplete: "off" },
      { key: "account_id", label: "Account ID", secret: false, autoComplete: "off" },
    ],
  },
];

export function marketingProvider(id: string): MarketingProvider | null {
  return MARKETING_PROVIDERS.find((provider) => provider.id === id) ?? null;
}

export type PublicFieldStatus = {
  key: string;
  label: string;
  secret: boolean;
  value: string;
  configured: boolean;
};

export type PublicProviderStatus = {
  id: MarketingProviderId;
  label: string;
  description: string;
  configured: boolean;
  fields: PublicFieldStatus[];
};

export function mergeProviderFields(
  provider: MarketingProvider,
  incoming: Record<string, string>,
  existing: Record<string, string> | null,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const field of provider.fields) {
    const submitted = (incoming[field.key] ?? "").trim();
    if (field.secret && !submitted) {
      const previous = existing?.[field.key]?.trim() ?? "";
      if (previous) next[field.key] = previous;
      continue;
    }
    if (submitted) next[field.key] = submitted;
  }
  return next;
}

export function providerHasValues(values: Record<string, string>): boolean {
  return Object.values(values).some((value) => value.trim().length > 0);
}

function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const tail = trimmed.slice(-4);
  return trimmed.length <= 4 ? "Saved" : `Saved ····${tail}`;
}

export function toPublicProviderStatus(
  provider: MarketingProvider,
  values: Record<string, string> | null,
): PublicProviderStatus {
  const fields = provider.fields.map((field) => {
    const raw = values?.[field.key]?.trim() ?? "";
    return {
      key: field.key,
      label: field.label,
      secret: field.secret,
      value: field.secret ? "" : raw,
      configured: field.secret ? Boolean(raw) : Boolean(raw),
    };
  });
  return {
    id: provider.id,
    label: provider.label,
    description: provider.description,
    configured: fields.some((field) => field.configured),
    fields: fields.map((field) => {
      const raw = values?.[field.key]?.trim() ?? "";
      return {
        ...field,
        value: field.secret ? maskSecret(raw) : raw,
      };
    }),
  };
}

export function pickCredentialPair(
  storedId: string | undefined,
  storedSecret: string | undefined,
  envId: string | undefined,
  envSecret: string | undefined,
): { clientId: string; clientSecret: string } | null {
  const organizationId = storedId?.trim() ?? "";
  const organizationSecret = storedSecret?.trim() ?? "";
  if (organizationId && organizationSecret) {
    return { clientId: organizationId, clientSecret: organizationSecret };
  }
  const fallbackId = envId?.trim() ?? "";
  const fallbackSecret = envSecret?.trim() ?? "";
  if (!organizationId && !organizationSecret && fallbackId && fallbackSecret) {
    return { clientId: fallbackId, clientSecret: fallbackSecret };
  }
  return null;
}

export function resolveGoogleAdsCredentialSet(input: {
  stored: Record<string, string> | null;
  envClientId?: string;
  envClientSecret?: string;
  envDeveloperToken?: string;
}): { clientId: string; clientSecret: string; developerToken: string } | null {
  const pair = pickCredentialPair(
    input.stored?.client_id,
    input.stored?.client_secret,
    input.envClientId,
    input.envClientSecret,
  );
  const developerToken = input.stored?.developer_token?.trim() || input.envDeveloperToken?.trim() || "";
  if (!pair || !developerToken) return null;
  return { ...pair, developerToken };
}
