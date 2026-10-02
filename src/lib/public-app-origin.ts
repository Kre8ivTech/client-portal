const INTERNAL_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "::", "::1", "localhost"]);

function httpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (INTERNAL_HOSTS.has(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Browser redirects must use the public site origin.
 * Behind the reverse proxy, Next sees the container bind address (0.0.0.0:3000).
 */
export function publicAppOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    const origin = httpOrigin(configured);
    if (origin) return origin;
  }

  return httpOrigin(requestUrl) ?? new URL(requestUrl).origin;
}
