const BIND_HOSTS = new Set(["0.0.0.0", "::", "::1"]);
const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);

function firstHost(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim().toLowerCase();
  return first || null;
}

function hostnameOf(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(1, end);
  }
  return host.split(":")[0] || host;
}

function portOf(host: string): string | null {
  if (host.startsWith("[")) return null;
  const parts = host.split(":");
  if (parts.length !== 2) return null;
  return parts[1] || null;
}

function configuredOrigin(configuredAppUrl: string | null | undefined): string | null {
  const value = configuredAppUrl?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (BIND_HOSTS.has(host) || LOCAL_DEV_HOSTS.has(host)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function hostnameFromOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Callback origin for a magic-link email.
 * A verified partner domain or the configured platform host is used as-is.
 * Container bind addresses and unknown hosts fall back to the platform origin.
 */
export function magicLinkCallbackUrl(input: {
  requestHost: string | null | undefined;
  configuredAppUrl: string | null | undefined;
  verifiedCustomDomain: boolean;
}): string {
  const platform = configuredOrigin(input.configuredAppUrl);
  const rawHost = firstHost(input.requestHost);
  const hostname = rawHost ? hostnameOf(rawHost) : null;

  if (hostname && LOCAL_DEV_HOSTS.has(hostname)) {
    const port = rawHost ? portOf(rawHost) : null;
    const portSuffix = port && port !== "80" && port !== "443" ? `:${port}` : "";
    return `http://${hostname}${portSuffix}/auth/callback`;
  }

  const platformHost = hostnameFromOrigin(platform);
  const useRequestHost = Boolean(
    hostname &&
      !BIND_HOSTS.has(hostname) &&
      (input.verifiedCustomDomain || (platformHost && hostname === platformHost)),
  );

  if (useRequestHost && hostname) {
    return `https://${hostname}/auth/callback`;
  }

  if (platform) return `${platform}/auth/callback`;
  return "http://localhost:3000/auth/callback";
}
