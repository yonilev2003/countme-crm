"use client";

import Link from "next/link";
import { Hash, AtSign, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChannelListItemData = {
  id: string;
  type: "channel" | "dm" | "person_thread";
  label: string;
  avatarUrl?: string | null;
  isPrivate?: boolean;
};

export type ChannelListItemProps = {
  channel: ChannelListItemData;
  active: boolean;
  unread: number;
};

export function ChannelListItem({
  channel,
  active,
  unread,
}: ChannelListItemProps) {
  return (
    <Link
      href={`/chat/${channel.id}`}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-brand-50 text-brand-800"
          : "text-slate-700 hover:bg-slate-100",
      )}
    >
      <ChannelIcon channel={channel} />
      <span className="min-w-0 flex-1 truncate">{channel.label}</span>
      {unread > 0 && (
        <span
          className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
            active ? "bg-brand-600 text-white" : "bg-brand-500 text-white",
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}

function ChannelIcon({ channel }: { channel: ChannelListItemData }) {
  if (channel.type === "channel") {
    return <Hash className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />;
  }
  if (channel.type === "person_thread") {
    return <UserIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />;
  }
  // dm — show avatar if available, fallback to @-icon
  if (channel.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={channel.avatarUrl}
        alt=""
        className="h-5 w-5 shrink-0 rounded-full border border-slate-200 object-cover"
      />
    );
  }
  return <AtSign className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />;
}
