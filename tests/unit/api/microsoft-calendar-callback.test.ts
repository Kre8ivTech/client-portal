// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSignedOAuthState } from "@/lib/oauth-state";
import { calendarPkceChallenge } from "@/lib/integrations/microsoft-calendar";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), user: vi.fn(), profile: vi.fn(), sync: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({
  auth: { getUser: mocks.user },
  from: (table: string) => table === "users"
    ? { select: () => ({ eq: () => ({ single: mocks.profile }) }) }
    : { upsert: mocks.upsert },
}) }));
vi.mock("@/lib/integrations/staff-calendar-sync", () => ({ syncStaffCalendarFromOAuth: mocks.sync }));
import { GET } from "@/app/api/integrations/microsoft/callback/route";
const verifier = "v".repeat(43);
function request(cookie = true) {
  const state = createSignedOAuthState({ userId: "portal-user", ts: Date.now(), returnTo: "/dashboard/settings", challenge: calendarPkceChallenge(verifier) });
  return new NextRequest(`https://0.0.0.0:3000/api/integrations/microsoft/callback?code=test&state=${state}`, { headers: cookie ? { cookie: `microsoft-calendar-pkce=${verifier}` } : {} });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://clients.kre8ivtech.com");
  vi.stubEnv("OAUTH_STATE_SECRET", "test-state-secret");
  vi.stubEnv("ENCRYPTION_SECRET", "test-encryption-key-".repeat(3));
  vi.stubEnv("MICROSOFT_CALENDAR_CLIENT_ID", "application-id");
  vi.stubEnv("MICROSOFT_CALENDAR_CLIENT_SECRET", "server-secret");
  mocks.user.mockResolvedValue({ data: { user: { id: "portal-user" } } });
  mocks.profile.mockResolvedValue({ data: { organization_id: "client-org", role: "client" }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.sync.mockResolvedValue({ error: null });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const token = { access_token: "sensitive-access", refresh_token: "sensitive-refresh", expires_in: 3600, scope: "User.Read Calendars.ReadWrite" };
function responses(profileStatus = 200) {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(token))
    .mockResolvedValueOnce(Response.json(profileStatus === 200 ? { id: "ms-user", mail: "person@client.example", userPrincipalName: "person@client.example" } : { error: "Denied" }, { status: profileStatus }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
describe("Microsoft calendar callback", () => {
  it("saves an external client connection encrypted without adding them to staff capacity", async () => {
    const fetchMock = responses();
    const response = await GET(request());
    expect(response.headers.get("location")).toBe("https://clients.kre8ivtech.com/dashboard/settings?success=microsoft_connected");
    const saved = mocks.upsert.mock.calls[0][0];
    expect(saved).toMatchObject({ user_id: "portal-user", organization_id: "client-org", provider_user_id: "ms-user" });
    expect(saved.access_token).toMatch(/^enc:v1:/);
    expect(saved.refresh_token).toMatch(/^enc:v1:/);
    expect(JSON.stringify(saved)).not.toContain("sensitive-access");
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].body.get("code_verifier")).toBe(verifier);
    expect(response.cookies.get("microsoft-calendar-pkce")?.value).toBe("");
  });
  it("rejects a failed Graph profile response without saving", async () => {
    responses(403);
    expect((await GET(request())).headers.get("location")).toBe("https://clients.kre8ivtech.com/dashboard/settings?error=profile_failed");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it("rejects callbacks from another browser or another portal user", async () => {
    const fetchMock = responses();
    expect((await GET(request(false))).headers.get("location")).toContain("error=state_expired");
    mocks.user.mockResolvedValue({ data: { user: { id: "someone-else" } } });
    expect((await GET(request())).headers.get("location")).toContain("error=unauthorized");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("mirrors staff connections only after saving succeeds", async () => {
    responses();
    mocks.profile.mockResolvedValue({ data: { organization_id: "our-org", role: "staff" }, error: null });
    await GET(request());
    expect(mocks.sync).toHaveBeenCalledOnce();
  });
});
