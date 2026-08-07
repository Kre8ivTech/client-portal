import { describe, expect, it } from "vitest";
import {
  formatErrorForIssue,
  redactDiagnosticText,
  sanitizeErrorRoute,
  type ErrorLogRecord,
} from "@/lib/error-logs";
import { errorLogSchema } from "@/lib/validators/error-log";

const log: ErrorLogRecord = {
  id: "12f71a72-3c8a-4815-835f-c7e54662db0c",
  organization_id: "4bf82d20-188f-48b6-b2d0-09301fca4f4e",
  user_id: "ea30277e-7563-4a3f-809c-93c08ebd7323",
  severity: "error",
  source: "react_error_boundary",
  message: "Could not load invoice",
  stack_trace: "Error: Could not load invoice\n    at InvoicePage",
  digest: "next-digest-123",
  route: "/dashboard/invoices/123",
  user_agent: "Test Browser",
  environment: "preview",
  release: "abc123",
  context: { filename: "/static/chunk.js", line: 42, column: 7 },
  created_at: "2026-08-06T15:30:00.000Z",
};

describe("error log diagnostics", () => {
  it("redacts credentials, emails, JWTs, and URL query values", () => {
    const value = [
      "password=hunter2",
      "Bearer secret-token",
      "user@example.com",
      "https://portal.test/page?token=secret#section",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
    ].join(" ");

    const redacted = redactDiagnosticText(value, 5_000);

    expect(redacted).not.toContain("hunter2");
    expect(redacted).not.toContain("secret-token");
    expect(redacted).not.toContain("user@example.com");
    expect(redacted).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(redacted).toContain("https://portal.test/page?[REDACTED]");
  });

  it("stores only the pathname for routes", () => {
    expect(sanitizeErrorRoute("https://portal.test/dashboard/tickets?token=abc#details")).toBe(
      "/dashboard/tickets",
    );
  });

  it("formats a complete copy-ready issue report", () => {
    const report = formatErrorForIssue(log);

    expect(report).toContain("## Error report");
    expect(report).toContain(`- Log ID: ${log.id}`);
    expect(report).toContain("Could not load invoice");
    expect(report).toContain("at InvoicePage");
    expect(report).toContain('"line": 42');
  });

  it("keeps copied diagnostics inside Markdown code fences", () => {
    const report = formatErrorForIssue({
      ...log,
      message: "Failure ``` @team",
      stack_trace: "```markdown\nmalicious markup\n```",
    });

    expect(report).not.toContain("Failure ``` @team");
    expect(report).not.toContain("```markdown");
  });

  it("accepts the bounded client payload and rejects unknown fields", () => {
    expect(
      errorLogSchema.safeParse({
        message: "Runtime failure",
        source: "window_error",
        route: "/dashboard",
        context: { line: 10, column: 2 },
      }).success,
    ).toBe(true);

    expect(
      errorLogSchema.safeParse({
        message: "Runtime failure",
        source: "window_error",
        accessToken: "should-not-be-accepted",
      }).success,
    ).toBe(false);
  });

  it("rejects oversized diagnostic fields", () => {
    expect(
      errorLogSchema.safeParse({
        message: "x".repeat(2_001),
        source: "window_error",
      }).success,
    ).toBe(false);

    expect(
      errorLogSchema.safeParse({
        message: "Runtime failure",
        source: "window_error",
        route: `/dashboard/${"x".repeat(500)}`,
      }).success,
    ).toBe(false);
  });
});
