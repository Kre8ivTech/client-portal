type RealtimeChannelLike = {
  topic: string;
};

type ChannelBuilder = {
  on: (event: string, filter: Record<string, string>, callback: () => void) => ChannelBuilder;
  subscribe: () => RealtimeChannelLike;
};

type ChannelClient = {
  getChannels: () => RealtimeChannelLike[];
  removeChannel: (channel: RealtimeChannelLike) => Promise<unknown> | unknown;
  channel: (topic: string) => ChannelBuilder;
};

/**
 * Subscribe to a named realtime topic, replacing any channel already joined
 * under that topic. Supabase returns the existing channel for a repeated name
 * and throws if `.on()` runs after `subscribe()`.
 */
export async function subscribeReplacingTopic(
  supabase: ChannelClient,
  topic: string,
  filter: Record<string, string>,
  onChange: () => void,
): Promise<RealtimeChannelLike> {
  const realtimeTopic = `realtime:${topic}`;
  const stale = supabase.getChannels().filter((existing) => existing.topic === realtimeTopic);
  await Promise.all(stale.map((existing) => supabase.removeChannel(existing)));

  return supabase.channel(topic).on("postgres_changes", filter, onChange).subscribe();
}
