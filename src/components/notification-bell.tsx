"use client";

// Topbar notification bell. Self-contained: fetches its own data, manages
// its own dropdown, polls every 60 seconds (only when the tab is visible).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckSquare,
  AtSign,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { getMyNotifications } from "./notification-bell-actions";
import type { NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return "עכשיו";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `לפני ${diffHour} שעות`;
  const diffDay = Math.round(diffHour / 24);
  return `לפני ${diffDay} ימים`;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getMyNotifications();
      setItems(next);
    } catch {
      // best-effort — keep showing whatever we had
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount.
  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  // Polling — skip while the tab is hidden so we don't burn API quota on
  // background tabs. Resume immediately when the user comes back.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void fetchItems();
    };
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        void fetchItems();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchItems]);

  // Refresh on open so the count is fresh when the user looks.
  useEffect(() => {
    if (open) void fetchItems();
  }, [open, fetchItems]);

  // Close on outside click + Escape while open.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tasks = items.filter(
    (i): i is Extract<NotificationItem, { type: "task_assigned" }> =>
      i.type === "task_assigned",
  );
  const mentions = items.filter(
    (i): i is Extract<NotificationItem, { type: "chat_mention" }> =>
      i.type === "chat_mention",
  );
  const unread = items.filter(
    (i): i is Extract<NotificationItem, { type: "chat_unread" }> =>
      i.type === "chat_unread",
  );

  // Badge total: tasks + mentions + unread channels. Capped at 99+ display.
  const totalCount = tasks.length + mentions.length + unread.length;

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        aria-label="התראות"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span
            className="absolute top-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white shadow-sm"
            style={{ insetInlineEnd: "0.125rem" }}
            aria-label={`${totalCount} התראות חדשות`}
          >
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-12 end-0 z-50 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">התראות</div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {totalCount > 0 && <span>{totalCount} חדשות</span>}
            </div>
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {totalCount === 0 && !loading && <EmptyState />}

            {tasks.length > 0 && (
              <Section
                title="משימות חדשות שלי"
                icon={<CheckSquare className="h-3.5 w-3.5 text-brand-500" />}
              >
                {tasks.slice(0, 5).map((t) => (
                  <button
                    key={`task-${t.id}`}
                    type="button"
                    onClick={() => navigate(t.href)}
                    className="block w-full px-4 py-2.5 text-start hover:bg-slate-50"
                  >
                    <div className="truncate text-sm font-medium text-slate-900">
                      {t.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {labelForTaskStatus(t.status)} · {formatRelative(t.created_at)}
                    </div>
                  </button>
                ))}
              </Section>
            )}

            {mentions.length > 0 && (
              <Section
                title="אזכורים בצ׳אט"
                icon={<AtSign className="h-3.5 w-3.5 text-brand-500" />}
              >
                {mentions.slice(0, 5).map((m) => (
                  <button
                    key={`mention-${m.message_id}`}
                    type="button"
                    onClick={() => navigate(m.href)}
                    className="block w-full px-4 py-2.5 text-start hover:bg-slate-50"
                  >
                    <div className="truncate text-sm font-medium text-slate-900">
                      {m.sender_name} · {m.channel_label}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-xs text-slate-600">
                      {m.preview}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {formatRelative(m.created_at)}
                    </div>
                  </button>
                ))}
              </Section>
            )}

            {unread.length > 0 && (
              <Section
                title="הודעות לא נקראו"
                icon={<MessageSquare className="h-3.5 w-3.5 text-brand-500" />}
              >
                {unread.slice(0, 5).map((u) => (
                  <button
                    key={`unread-${u.channel_id}`}
                    type="button"
                    onClick={() => navigate(u.href)}
                    className="block w-full px-4 py-2.5 text-start hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {u.channel_label}
                      </div>
                      <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold text-brand-700">
                        {u.count}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {u.count === 1 ? "הודעה חדשה" : `${u.count} הודעות חדשות`}
                    </div>
                  </button>
                ))}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <div className="flex items-center gap-1.5 bg-slate-50/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        <span>{title}</span>
      </div>
      <div className="py-1">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Bell className="h-10 w-10 text-slate-200" />
      <div>
        <div className="text-sm font-medium text-slate-700">
          הכל שקט כרגע
        </div>
        <div className="mt-1 text-xs text-slate-500">
          אין התראות חדשות. תהיו בקשר.
        </div>
      </div>
    </div>
  );
}

function labelForTaskStatus(status: string): string {
  switch (status) {
    case "todo":
      return "לעשות";
    case "doing":
      return "בביצוע";
    case "done":
      return "הושלם";
    default:
      return status;
  }
}
