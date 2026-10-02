// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({
    auth: { signOut },
  }),
}));

import { POST } from "@/app/auth/signout/route";

beforeEach(() => {
  signOut.mockReset();
  signOut.mockResolvedValue({ error: null });
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clients.kre8ivtech.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /auth/signout", () => {
  it("sends the browser to the public login page", async () => {
    const response = await POST(new Request("https://0.0.0.0:3000/auth/signout", { method: "POST" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://clients.kre8ivtech.com/login");
  });
});
