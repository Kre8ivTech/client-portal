import { afterEach, describe, expect, it, vi } from "vitest";
import { publicAppOrigin } from "@/lib/public-app-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicAppOrigin", () => {
  it("uses the configured public site when the request host is the container bind address", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clients.kre8ivtech.com");
    expect(publicAppOrigin("https://0.0.0.0:3000/auth/signout")).toBe(
      "https://clients.kre8ivtech.com",
    );
  });

  it("ignores a trailing slash on the configured URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clients.kre8ivtech.com/");
    expect(publicAppOrigin("https://0.0.0.0:3000/auth/signout")).toBe(
      "https://clients.kre8ivtech.com",
    );
  });

  it("keeps a public request origin when no app URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(publicAppOrigin("https://clients.kre8ivtech.com/auth/signout")).toBe(
      "https://clients.kre8ivtech.com",
    );
  });
});
