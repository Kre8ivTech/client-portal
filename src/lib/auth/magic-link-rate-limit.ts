export function createSlidingWindowLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return {
    attempt(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
