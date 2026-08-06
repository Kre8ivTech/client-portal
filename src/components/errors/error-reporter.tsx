"use client";

import { useEffect } from "react";
import {
  redactDiagnosticText,
  sanitizeErrorRoute,
  type ErrorLogContext,
  type ErrorLogPayload,
  type ErrorLogSource,
} from "@/lib/error-logs";

const reportedErrors = new Set<string>();
const MAX_SESSION_FINGERPRINTS = 100;

function getErrorDetails(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) {
    return { message: reason.message || reason.name, stack: reason.stack };
  }

  if (typeof reason === "string") {
    return { message: reason };
  }

  try {
    return { message: JSON.stringify(reason) };
  } catch {
    return { message: "Unknown client error" };
  }
}

export function reportClientError(
  reason: unknown,
  source: ErrorLogSource,
  options: { digest?: string; context?: ErrorLogContext } = {},
): void {
  const details = getErrorDetails(reason);
  const message = redactDiagnosticText(details.message, 2_000) ?? "Unknown client error";
  const route = typeof window === "undefined" ? null : sanitizeErrorRoute(window.location.href);
  const payload: ErrorLogPayload = {
    message,
    source,
    ...(details.stack
      ? { stack: redactDiagnosticText(details.stack, 12_000) ?? undefined }
      : {}),
    ...(options.digest ? { digest: options.digest.slice(0, 255) } : {}),
    ...(route ? { route } : {}),
    ...(options.context ? { context: options.context } : {}),
  };
  const fingerprint = [payload.source, payload.route, payload.digest, payload.message].join("|");

  if (reportedErrors.has(fingerprint)) return;
  if (reportedErrors.size >= MAX_SESSION_FINGERPRINTS) reportedErrors.clear();
  reportedErrors.add(fingerprint);

  void fetch("/api/error-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}

export function ErrorReporter() {
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      reportClientError(event.error ?? event.message, "window_error", {
        context: {
          ...(event.filename ? { filename: sanitizeErrorRoute(event.filename) ?? undefined } : {}),
          ...(event.lineno ? { line: event.lineno } : {}),
          ...(event.colno ? { column: event.colno } : {}),
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportClientError(event.reason, "unhandled_rejection");
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
