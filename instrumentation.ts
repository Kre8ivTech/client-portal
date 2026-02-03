type UnknownRecord = Record<string, unknown>;

function getErrorInfo(err: unknown): {
  name?: string;
  message?: string;
  stack?: string;
  digest?: string;
} {
  if (err instanceof Error) {
    const anyErr = err as Error & { digest?: string };
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      digest: typeof anyErr.digest === "string" ? anyErr.digest : undefined,
    };
  }
  if (typeof err === "object" && err) {
    const anyErr = err as UnknownRecord;
    return {
      name: typeof anyErr.name === "string" ? anyErr.name : undefined,
      message: typeof anyErr.message === "string" ? anyErr.message : undefined,
      stack: typeof anyErr.stack === "string" ? anyErr.stack : undefined,
      digest: typeof anyErr.digest === "string" ? anyErr.digest : undefined,
    };
  }
  return {};
}

function safeUrlToPathname(url: unknown): string | undefined {
  if (typeof url !== "string" || !url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    // Might be a relative URL
    const q = url.indexOf("?");
    const hash = url.indexOf("#");
    const end = Math.min(q === -1 ? url.length : q, hash === -1 ? url.length : hash);
    return url.slice(0, end);
  }
}

// Next.js instrumentation hook.
// This runs server-side and is a safe place to log details that are redacted from RSC payloads
// in production (where the browser only sees a "digest").
export async function register() {
  // No-op: using this file primarily for onRequestError logging.
}

export function onRequestError(
  error: unknown,
  request: unknown,
  context: unknown,
) {
  const errInfo = getErrorInfo(error);

  const req = (request ?? {}) as UnknownRecord;
  const ctx = (context ?? {}) as UnknownRecord;

  const method = typeof req.method === "string" ? req.method : undefined;
  const url = typeof req.url === "string" ? req.url : undefined;
  const pathname = safeUrlToPathname(url) ?? (typeof req.pathname === "string" ? req.pathname : undefined);

  const routerKind = typeof ctx.routerKind === "string" ? ctx.routerKind : undefined;
  const routePath = typeof ctx.routePath === "string" ? ctx.routePath : undefined;
  const routeType = typeof ctx.routeType === "string" ? ctx.routeType : undefined;

  // Important: do NOT log cookies/authorization headers.
  console.error("[Next onRequestError]", {
    digest: errInfo.digest,
    name: errInfo.name,
    message: errInfo.message,
    stack: errInfo.stack,
    request: { method, pathname },
    context: { routerKind, routeType, routePath },
  });
}

