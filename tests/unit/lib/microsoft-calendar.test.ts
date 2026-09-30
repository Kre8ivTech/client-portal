// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarPkceChallenge, validCalendarState, encryptCalendarToken, decryptCalendarToken, microsoftCalendarTokens, microsoftCalendarProfile } from "@/lib/integrations/microsoft-calendar";

afterEach(() => vi.unstubAllEnvs());
describe("Microsoft calendar connection protection", () => {
  it("binds fresh state to the browser's PKCE verifier", () => {
    const verifier = "a".repeat(43);
    const state = { ts: Date.now(), challenge: calendarPkceChallenge(verifier) };
    expect(validCalendarState(state, verifier)).toBe(true);
    expect(validCalendarState(state, "b".repeat(43))).toBe(false);
    expect(validCalendarState(state)).toBe(false);
    expect(validCalendarState({ ...state, ts: Date.now() - 600001 }, verifier)).toBe(false);
    expect(validCalendarState({ ...state, ts: Date.now() + 10000 }, verifier)).toBe(false);
    expect(validCalendarState({ ...state, ts: NaN }, verifier)).toBe(false);
  });
  it("requires a refresh token, valid expiration and calendar consent", () => {
    const tokens = { access_token: "access", refresh_token: "refresh", expires_in: 3600, scope: "User.Read Calendars.ReadWrite" };
    expect(microsoftCalendarTokens.safeParse(tokens).success).toBe(true);
    expect(microsoftCalendarTokens.safeParse({ ...tokens, refresh_token: undefined }).success).toBe(false);
    expect(microsoftCalendarTokens.safeParse({ ...tokens, expires_in: -1 }).success).toBe(false);
    expect(microsoftCalendarTokens.safeParse({ ...tokens, scope: "User.Read" }).success).toBe(false);
    expect(microsoftCalendarProfile.safeParse({ error: { message: "Forbidden" } }).success).toBe(false);
  });
  it("encrypts tokens with authenticated encryption and rejects tampering", () => {
    vi.stubEnv("ENCRYPTION_SECRET", "test-calendar-key-".repeat(3));
    const encrypted = encryptCalendarToken("sensitive-access-token");
    expect(encrypted).not.toContain("sensitive-access-token");
    expect(decryptCalendarToken(encrypted)).toBe("sensitive-access-token");
    expect(encryptCalendarToken("sensitive-access-token")).not.toBe(encrypted);
    const value = JSON.parse(encrypted.slice(7));
    value.authTag = Buffer.alloc(16).toString("base64");
    expect(() => decryptCalendarToken(`enc:v1:${JSON.stringify(value)}`)).toThrow();
    expect(() => decryptCalendarToken("plain-text-token")).toThrow();
  });
});
