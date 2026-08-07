export const ERROR_LOG_SOURCES = [
  "react_error_boundary",
  "window_error",
  "unhandled_rejection",
] as const;

export type ErrorLogSource = (typeof ERROR_LOG_SOURCES)[number];

export type ErrorLogContext = {
  filename?: string;
  line?: number;
  column?: number;
};

export type ErrorLogPayload = {
  message: string;
  stack?: string;
  digest?: string;
  route?: string;
  source: ErrorLogSource;
  context?: ErrorLogContext;
};

export type ErrorLogRecord = {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  severity: "error" | "warning";
  source: ErrorLogSource;
  message: string;
  stack_trace: string | null;
  digest: string | null;
  route: string | null;
  user_agent: string | null;
  environment: string | null;
  release: string | null;
  context: ErrorLogContext;
  created_at: string;
};

const SENSITIVE_VALUE_PATTERN =
  /((?:password|passwd|secret|token|api[_-]?key|authorization|cookie)\s*[:=]\s*)([^\s,;]+)/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_QUERY_PATTERN = /(https?:\/\/[^\s?#]+)\?[^\s#]*/gi;

export function redactDiagnosticText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  if (!value) return null;

  return value
    .replace(URL_QUERY_PATTERN, "$1?[REDACTED]")
    .replace(BEARER_PATTERN, "Bearer [REDACTED]")
    .replace(JWT_PATTERN, "[REDACTED_JWT]")
    .replace(SENSITIVE_VALUE_PATTERN, "$1[REDACTED]")
    .replace(EMAIL_PATTERN, "[REDACTED_EMAIL]")
    .slice(0, maxLength);
}

export function sanitizeErrorRoute(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, "https://portal.invalid");
    return url.pathname.slice(0, 500) || "/";
  } catch {
    return value.split(/[?#]/, 1)[0].slice(0, 500) || null;
  }
}

export function formatErrorForIssue(log: ErrorLogRecord): string {
  const context = Object.keys(log.context).length
    ? JSON.stringify(log.context, null, 2)
    : "None";
  const message = log.message.replaceAll("```", "``\u200b`");
  const stackTrace = (log.stack_trace ?? "No stack trace captured.").replaceAll(
    "```",
    "``\u200b`",
  );
  const userAgent = (log.user_agent ?? "Unknown").replaceAll("```", "``\u200b`");

  return [
    "## Error report",
    "",
    `- Log ID: ${log.id}`,
    `- Occurred: ${new Date(log.created_at).toISOString()}`,
    `- Severity: ${log.severity}`,
    `- Source: ${log.source}`,
    `- Environment: ${log.environment ?? "Unknown"}`,
    `- Release: ${log.release ?? "Unknown"}`,
    `- Route: ${log.route ?? "Unknown"}`,
    `- User ID: ${log.user_id ?? "Unknown"}`,
    `- Organization ID: ${log.organization_id ?? "Unknown"}`,
    `- Digest: ${log.digest ?? "None"}`,
    "",
    "### Message",
    "```text",
    message,
    "```",
    "",
    "### Stack trace",
    "```text",
    stackTrace,
    "```",
    "",
    "### Context",
    "```json",
    context,
    "```",
    "",
    "### User agent",
    "```text",
    userAgent,
    "```",
  ].join("\n");
}
