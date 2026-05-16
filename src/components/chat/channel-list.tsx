"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  ChannelListItem,
  type ChannelListItemData,
} from "./channel-list-item";
import { NewChannelDialog } from "./new-channel-dialog";

export type ChannelListProps = {
  channels: ChannelListItemData[];
  unreadCounts: Record<string, number>;
  activeChannelId: string | null;
};

export function ChannelList({
  channels,
  unreadCounts,
  activeChannelId,
}: ChannelListProps) {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return channels;
    const q = query.trim().toLowerCase();
    return channels.filter((c) => c.label.toLowerCase().includes(q));
  }, [channels, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="font-display text-base font-bold text-slate-900">
          שיחות
        </h2>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-600"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          <span>ערוץ חדש</span>
        </button>
      </div>

      <div className="border-b border-slate-100 px-3 py-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute inset-y-0 my-auto h-4 w-4 text-slate-400 start-2.5"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש ערוץ או שיחה"
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 ps-8 pe-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">
            {query ? "אין תוצאות" : "אין שיחות עדיין"}
          </div>
        ) : (
          filtered.map((channel) => (
            <ChannelListItem
              key={channel.id}
              channel={channel}
              active={channel.id === activeChannelId}
              unread={unreadCounts[channel.id] ?? 0}
            />
          ))
        )}
      </nav>

      {dialogOpen && (
        <NewChannelDialog onClose={() => setDialogOpen(false)} />
      )}
    </div>
  );
}
