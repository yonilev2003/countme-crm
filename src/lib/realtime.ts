import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type RealtimeMessageRow = {
  id: string;
  channel_id: string;
  sender_id: string;
  body: string;
  attachments: unknown;
  created_at: string;
};

/**
 * Subscribe to INSERT events on the messages table filtered to a single channel.
 * Returns an unsubscribe function that removes the channel from the client.
 *
 * The publication includes the `messages` table (see 0004_realtime_publication.sql).
 * Default replica identity (primary key only) is enough for INSERT events — the
 * full row is delivered in `payload.new`.
 */
export function subscribeToChannelMessages(
  supabase: SupabaseClient,
  channelId: string,
  onInsert: (row: RealtimeMessageRow) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:channel:${channelId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        const row = payload.new as RealtimeMessageRow;
        if (row && row.id) onInsert(row);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
