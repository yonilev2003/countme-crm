import { notFound, redirect } from "next/navigation";
import { Hash, Lock, AtSign, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ChannelList } from "@/components/chat/channel-list";
import { Composer } from "@/components/chat/composer";
import {
  MessageList,
  type MessageListInitialMessage,
  type MessageListSenderInfo,
} from "@/components/chat/message-list";
import { loadChannelMeta, loadChannelSidebar } from "../_data";

type MessageRow = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  attachments: unknown;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const meta = await loadChannelMeta(supabase, channelId, user.id);
  if (!meta) notFound();

  // Current user profile for composer avatar
  const { data: meProfile } = await supabase
    .from("profiles")
    .select("display_name, full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // All team profiles — needed both for message sender info AND for the
  // composer's @-mention autocomplete.
  const { data: profilesRaw } = await supabase
    .from("profiles")
    .select("id, display_name, full_name, avatar_url");
  const profileRows = (profilesRaw ?? []) as ProfileRow[];

  const profilesById: Record<string, MessageListSenderInfo> = {};
  for (const p of profileRows) {
    profilesById[p.id] = {
      id: p.id,
      displayName: p.display_name ?? p.full_name ?? "חבר/ת צוות",
      avatarUrl: p.avatar_url ?? null,
    };
  }

  // Last ~50 messages (server-side, newest first → reverse for chronological)
  const { data: rawMessages } = await supabase
    .from("messages")
    .select("id, body, sender_id, created_at, attachments")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(50);

  const messageRows = ((rawMessages ?? []) as MessageRow[]).slice().reverse();
  const initialMessages: MessageListInitialMessage[] = messageRows.map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    sender_id: m.sender_id,
    attachments: m.attachments,
    sender:
      profilesById[m.sender_id] ?? {
        id: m.sender_id,
        displayName: "חבר/ת צוות",
        avatarUrl: null,
      },
  }));

  // Sidebar (re-render on each navigation so unread counts are fresh)
  const { channels, unreadCounts } = await loadChannelSidebar(supabase, user.id);

  // Team members for @mention autocomplete — exclude me
  const teamMembers = profileRows
    .filter((p) => p.id !== user.id)
    .map((p) => ({
      id: p.id,
      displayName: p.display_name ?? p.full_name ?? "חבר/ת צוות",
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "he"));

  const meDisplay =
    meProfile?.display_name ??
    meProfile?.full_name ??
    user.email ??
    "אני";
  const meAvatar = meProfile?.avatar_url ?? null;

  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-e border-slate-200 bg-white md:flex md:flex-col">
        <ChannelList
          channels={channels}
          unreadCounts={unreadCounts}
          activeChannelId={channelId}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <ChannelHeader
          type={meta.channel.type}
          isPrivate={meta.channel.is_private}
          label={meta.headerLabel}
          subtitle={meta.headerSubtitle}
        />

        <MessageList
          initialMessages={initialMessages}
          channelId={channelId}
          currentUserId={user.id}
          membersById={profilesById}
        />

        <Composer
          channelId={channelId}
          currentUserId={user.id}
          currentDisplayName={meDisplay}
          currentAvatarUrl={meAvatar}
          teamMembers={teamMembers}
        />
      </main>
    </div>
  );
}

function ChannelHeader({
  type,
  isPrivate,
  label,
  subtitle,
}: {
  type: "channel" | "dm" | "person_thread";
  isPrivate: boolean;
  label: string;
  subtitle: string | null;
}) {
  const Icon =
    type === "channel"
      ? isPrivate
        ? Lock
        : Hash
      : type === "person_thread"
        ? UserIcon
        : AtSign;
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
      <Icon className="h-5 w-5 text-slate-500" aria-hidden />
      <div className="min-w-0">
        <div className="truncate font-display text-base font-bold text-slate-900">
          {label}
        </div>
        {subtitle && (
          <div className="truncate text-xs text-slate-500">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
