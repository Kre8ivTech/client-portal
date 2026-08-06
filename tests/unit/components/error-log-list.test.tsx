import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorLogList } from "@/components/admin/error-log-list";
import type { ErrorLogRecord } from "@/lib/error-logs";

const writeText = vi.fn();

const log: ErrorLogRecord = {
  id: "12f71a72-3c8a-4815-835f-c7e54662db0c",
  organization_id: null,
  user_id: "ea30277e-7563-4a3f-809c-93c08ebd7323",
  severity: "error",
  source: "window_error",
  message: "Ticket list failed to render",
  stack_trace: "Error: Ticket list failed to render",
  digest: null,
  route: "/dashboard/tickets",
  user_agent: "Test Browser",
  environment: "preview",
  release: "abc123",
  context: {},
  created_at: "2026-08-06T15:30:00.000Z",
};

describe("ErrorLogList", () => {
  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies a complete issue report for an error", async () => {
    render(<ErrorLogList initialLogs={[log]} />);

    fireEvent.click(screen.getByRole("button", { name: /copy error .* for issue tracking/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain(`- Log ID: ${log.id}`);
    expect(writeText.mock.calls[0][0]).toContain("Ticket list failed to render");
    expect(screen.getByRole("button", { name: /copy error/i })).toHaveTextContent("Copied");
  });

  it("filters errors by message or route", () => {
    render(<ErrorLogList initialLogs={[log]} />);

    fireEvent.change(screen.getByPlaceholderText(/search message/i), {
      target: { value: "not-a-match" },
    });

    expect(screen.getByText("No errors match these filters.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search message/i), {
      target: { value: "/dashboard/tickets" },
    });

    expect(screen.getByText("Ticket list failed to render")).toBeInTheDocument();
  });
});
