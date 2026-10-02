import { describe, expect, it } from "vitest";
import { createSlidingWindowLimiter } from "@/lib/auth/magic-link-rate-limit";

describe("createSlidingWindowLimiter", () => {
  it("blocks after the limit inside the window", () => {
    const limiter = createSlidingWindowLimiter(2, 1_000);
    expect(limiter.attempt("email:a@example.com", 0)).toBe(true);
    expect(limiter.attempt("email:a@example.com", 10)).toBe(true);
    expect(limiter.attempt("email:a@example.com", 20)).toBe(false);
    expect(limiter.attempt("email:b@example.com", 20)).toBe(true);
    expect(limiter.attempt("email:a@example.com", 1_100)).toBe(true);
  });
});
