"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  subscribeToChannelMessages,
  type RealtimeMessageRow,
} from "@/lib/realtime";
import { markChannelRead } from "@/app/(app)/chat/actions";
import { MessageItem, type MessageItemAttachment } from "./message-item";

export type MessageListSenderInfo = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MessageListInitialMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  attachments?: unknown;
  // Resolved sender (may be missing if the join was null — we still render)
  sender: MessageListSenderInfo;
  pending?: boolean;
  failed?: boolean;
};

type StoreMessage = MessageListInitialMessage;

export type MessageListProps = {
  initialMessages: MessageListInitialMessage[];
  channelId: string;
  currentUserId: string;
  membersById: Record<string, MessageListSenderInfo>;
};

// Group consecutive messages from the same sender if they were sent within
// this window (in minutes). Long pauses get a new header even from same sender.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function MessageList({
  initialMessages,
  channelId,
  currentUserId,
  membersById,
}: MessageListProps) {
  const [messages, setMessages] = useState<StoreMessage[]>(initialMessages);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const initialMountRef = useRef(true);

  // Keep a map of known senders, augmented by realtime messages.
  const sendersRef = useRef<Record<string, MessageListSenderInfo>>({
    ...membersById,
  });

  const resolveSender = useCallback(
    (senderId: string): MessageListSenderInfo => {
      const known = sendersRef.current[senderId];
      if (known) return known;
      return {
        id: senderId,
        displayName: senderId === currentUserId ? "אני" : "חבר/ת צוות",
        avatarUrl: null,
      };
    },
    [currentUserId],
  );

  // Subscribe to realtime inserts
  useEffect(() => {
    const supabase = createClient();
    const unsubscribe = subscribeToChannelMessages(
      supabase,
      channelId,
      (row: RealtimeMessageRow) => {
        setMessages((prev) => {
          // De-dupe by id (server-confirmed insert).
          if (prev.some((m) => m.id === row.id)) return prev;

          // If we have a pending optimistic message from this sender with
          // the same body, replace it.
          const optimisticIdx = prev.findIndex(
            (m) =>
              m.pending &&
              m.sender_id === row.sender_id &&
              m.body === row.body,
          );
          const sender = resolveSender(row.sender_id);
          const next: StoreMessage = {
            id: row.id,
            body: row.body,
            created_at: row.created_at,
            sender_id: row.sender_id,
            attachments: row.attachments,
            sender,
          };
          if (optimisticIdx >= 0) {
            const copy = prev.slice();
            copy[optimisticIdx] = next;
            return copy;
          }
          return [...prev, next];
        });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [channelId, resolveSender]);

  // Fire-and-forget mark-as-read whenever channel changes or new messages
  // arrive while we're focused.
  useEffect(() => {
    void markChannelRead(channelId);
  }, [channelId, messages.length]);

  // Track "was at bottom" before each render so the next layout effect knows
  // whether to auto-scroll.
  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distance < 80;
  }, []);

  // After each render, scroll to bottom if user was at the bottom (or first mount).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (initialMountRef.current || wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      initialMountRef.current = false;
    }
  }, [messages]);

  // Expose an append API to the composer via a custom event.
  useEffect(() => {
    function onAppend(e: Event) {
      const detail = (e as CustomEvent<StoreMessage>).detail;
      if (!detail) return;
      const sender = resolveSender(detail.sender_id);
      setMessages((prev) => [...prev, { ...detail, sender }]);
    }
    function onUpdate(e: Event) {
      const detail = (e as CustomEvent<{
        tempId: string;
        patch: Partial<StoreMessage>;
      }>).detail;
      if (!detail) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === detail.tempId ? { ...m, ...detail.patch } : m,
        ),
      );
    }
    const node = containerRef.current;
    if (!node) return;
    node.addEventListener("chat:append", onAppend as EventListener);
    node.addEventListener("chat:update", onUpdate as EventListener);
    return () => {
      node.removeEventListener("chat:append", onAppend as EventListener);
      node.removeEventListener("chat:update", onUpdate as EventListener);
    };
  }, [resolveSender]);

  // Compute "show header" once per message based on previous one.
  const rendered = useMemo(() => {
    return messages.map((m, idx) => {
      const prev = messages[idx - 1];
      let showHeader = true;
      if (prev && prev.sender_id === m.sender_id) {
        const gap =
          new Date(m.created_at).getTime() - new Date(prev.created_at).getTime();
        if (gap >= 0 && gap < GROUP_WINDOW_MS) {
          showHeader = false;
        }
      }
      return { m, showHeader };
    });
  }, [messages]);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      data-chat-stream
      data-channel-id={channelId}
      className="flex-1 overflow-y-auto py-4"
    >
      {rendered.length === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-500">
          אין הודעות עדיין. תכתבו משהו כדי להתחיל.
        </div>
      ) : (
        rendered.map(({ m, showHeader }) => (
          <MessageItem
            key={m.id}
            id={m.id}
            body={m.body}
            createdAt={m.created_at}
            sender={m.sender}
            attachments={
              Array.isArray(m.attachments)
                ? (m.attachments as MessageItemAttachment[])
                : undefined
            }
            showHeader={showHeader}
            pending={m.pending}
            failed={m.failed}
          />
        ))
      )}
    </div>
  );
}
