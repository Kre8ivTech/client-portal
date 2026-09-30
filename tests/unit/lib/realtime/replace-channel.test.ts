import { describe, expect, it, vi } from "vitest";
import { subscribeReplacingTopic } from "@/lib/realtime/replace-channel";

describe("subscribeReplacingTopic", () => {
  it("removes an already subscribed topic before adding callbacks", async () => {
    const stale = { topic: "realtime:conversations_changes" };
    const created = { topic: "realtime:conversations_changes" };
    const removeChannel = vi.fn(async () => "ok");
    const on = vi.fn().mockReturnThis();
    const subscribe = vi.fn(() => created);
    const channel = vi.fn(() => ({ on, subscribe }));
    const supabase = {
      getChannels: () => [stale, { topic: "realtime:other" }],
      removeChannel,
      channel,
    };

    const onChange = vi.fn();
    const result = await subscribeReplacingTopic(
      supabase,
      "conversations_changes",
      { event: "*", schema: "public", table: "conversations" },
      onChange,
    );

    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(removeChannel).toHaveBeenCalledWith(stale);
    expect(channel).toHaveBeenCalledWith("conversations_changes");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      onChange,
    );
    expect(result).toBe(created);
  });
});
