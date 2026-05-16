// Shared server-side helpers for the chat routes (landing + channel view).
// Not a route — Next.js treats underscored folders/files as private.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChannelListItemData } from "@/components/chat/channel-list-item";

type ChannelRow = {
  id: string;
  name: string | null;
  description: string | null;
  type: "channel" | "dm" | "person_thread";
  person_id: string | null;
  is_private: boolean;
  created_by: string;
  created_at: string;
};

type MemberRow = {
  channel_id: string;
  profile_id: string;
  last_read_at: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type PersonRow = {
  id: string;
  name: string;
};

export type LoadedChannelSidebar = {
  channels: ChannelListItemData[];
  unreadCounts: Record<string, number>;
};

/**
 * Loads the data needed to render the chat sidebar:
 *   - every channel the user can see (per RLS),
 *   - DM/person-thread labels resolved into human-readable text,
 *   - a per-channel unread count (messages newer than my last_read_at).
 *
 * Uses several small queries rather than one giant join — RLS is already
 * doing the heavy lifting and the per-team scale is tiny.
 */
export async function loadChannelSidebar(
  supabase: SupabaseClient,
  userId: string,
): Promise<LoadedChannelSidebar> {
  // 1) All channels visible to me (RLS filters)
  const { data: channels } = await supabase
    .from("channels")
    .select(
      "id, name, description, type, person_id, is_private, created_by, created_at",
    )
    .order("created_at", { ascending: true });

  const channelRows = (channels ?? []) as ChannelRow[];
  if (channelRows.length === 0) {
    return { channels: [], unreadCounts: {} };
  }

  const channelIds = channelRows.map((c) => c.id);

  // 2) My memberships for those channels (for unread + last_read_at)
  const { data: myMembers } = await supabase
    .from("channel_members")
    .select("channel_id, profile_id, last_read_at")
    .eq("profile_id", userId)
    .in("channel_id", channelIds);

  const myMembersByChannel = new Map<string, MemberRow>();
  for (const m of (myMembers ?? []) as MemberRow[]) {
    myMembersByChannel.set(m.channel_id, m);
  }

  // 3) For DM labels: pull all members of DM channels (so we can find "the
  // other person").
  const dmIds = channelRows.filter((c) => c.type === "dm").map((c) => c.id);
  let dmMembers: MemberRow[] = [];
  if (dmIds.length > 0) {
    const { data } = await supabase
      .from("channel_members")
      .select("channel_id, profile_id, last_read_at")
      .in("channel_id", dmIds);
    dmMembers = (data ?? []) as MemberRow[];
  }

  const otherDmProfileIds = new Set<string>();
  const dmMembersByChannel = new Map<string, MemberRow[]>();
  for (const m of dmMembers) {
    const arr = dmMembersByChannel.get(m.channel_id) ?? [];
    arr.push(m);
    dmMembersByChannel.set(m.channel_id, arr);
    if (m.profile_id !== userId) otherDmProfileIds.add(m.profile_id);
  }

  // 4) Fetch profiles for DM "other person" labels/avatars
  let profilesById = new Map<string, ProfileRow>();
  if (otherDmProfileIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, full_name, avatar_url")
      .in("id", Array.from(otherDmProfileIds));
    profilesById = new Map(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );
  }

  // 5) Person-thread labels — fetch people names
  const personIds = channelRows
    .filter((c) => c.type === "person_thread" && c.person_id)
    .map((c) => c.person_id as string);
  let peopleById = new Map<string, PersonRow>();
  if (personIds.length > 0) {
    const { data: people } = await supabase
      .from("people")
      .select("id, name")
      .in("id", personIds);
    peopleById = new Map(((people ?? []) as PersonRow[]).map((p) => [p.id, p]));
  }

  // 6) Unread counts — one HEAD count per channel. Cheap enough for v1.
  const unreadCounts: Record<string, number> = {};
  await Promise.all(
    channelRows.map(async (c) => {
      const member = myMembersByChannel.get(c.id);
      if (!member) {
        unreadCounts[c.id] = 0;
        return;
      }
      const lastRead = member.last_read_at;
      let q = supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", c.id)
        .neq("sender_id", userId);
      if (lastRead) q = q.gt("created_at", lastRead);
      const { count } = await q;
      unreadCounts[c.id] = count ?? 0;
    }),
  );

  // 7) Build the display list
  const items: ChannelListItemData[] = channelRows.map((c) => {
    if (c.type === "channel") {
      return {
        id: c.id,
        type: "channel",
        label: c.name ?? "(ללא שם)",
        isPrivate: c.is_private,
      };
    }
    if (c.type === "person_thread") {
      const person = c.person_id ? peopleById.get(c.person_id) : undefined;
      return {
        id: c.id,
        type: "person_thread",
        label: `שיחת CRM: ${person?.name ?? "—"}`,
        isPrivate: c.is_private,
      };
    }
    // dm
    const members = dmMembersByChannel.get(c.id) ?? [];
    const other = members.find((m) => m.profile_id !== userId);
    const profile = other ? profilesById.get(other.profile_id) : undefined;
    const label =
      profile?.display_name ??
      profile?.full_name ??
      (other ? "חבר/ת צוות" : "(שיחה ריקה)");
    return {
      id: c.id,
      type: "dm",
      label,
      avatarUrl: profile?.avatar_url ?? null,
      isPrivate: true,
    };
  });

  return { channels: items, unreadCounts };
}

export type LoadedChannelMeta = {
  channel: {
    id: string;
    name: string | null;
    description: string | null;
    type: "channel" | "dm" | "person_thread";
    person_id: string | null;
    is_private: boolean;
  };
  /** Display label suitable for the channel header */
  headerLabel: string;
  headerSubtitle: string | null;
};

/**
 * Resolves the human-readable header for a single channel view.
 */
export async function loadChannelMeta(
  supabase: SupabaseClient,
  channelId: string,
  userId: string,
): Promise<LoadedChannelMeta | null> {
  const { data: channel } = await supabase
    .from("channels")
    .select(
      "id, name, description, type, person_id, is_private, created_by, created_at",
    )
    .eq("id", channelId)
    .maybeSingle();

  if (!channel) return null;

  let headerLabel = "";
  let headerSubtitle: string | null = channel.description ?? null;

  if (channel.type === "channel") {
    headerLabel = channel.name ?? "(ללא שם)";
  } else if (channel.type === "person_thread") {
    if (channel.person_id) {
      const { data: person } = await supabase
        .from("people")
        .select("name")
        .eq("id", channel.person_id)
        .maybeSingle();
      headerLabel = `שיחת CRM: ${person?.name ?? "—"}`;
    } else {
      headerLabel = "שיחת CRM";
    }
    if (!headerSubtitle) {
      headerSubtitle = "שיחה משותפת לצוות סביב איש קשר";
    }
  } else {
    // dm
    const { data: members } = await supabase
      .from("channel_members")
      .select("profile_id")
      .eq("channel_id", channelId);
    const otherId = (members ?? [])
      .map((m) => m.profile_id as string)
      .find((id) => id !== userId);
    if (otherId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, full_name")
        .eq("id", otherId)
        .maybeSingle();
      headerLabel = profile?.display_name ?? profile?.full_name ?? "חבר/ת צוות";
    } else {
      headerLabel = "(שיחה ריקה)";
    }
    headerSubtitle = headerSubtitle ?? "הודעה פרטית";
  }

  return {
    channel: {
      id: channel.id,
      name: channel.name ?? null,
      description: channel.description ?? null,
      type: channel.type,
      person_id: channel.person_id ?? null,
      is_private: channel.is_private,
    },
    headerLabel,
    headerSubtitle,
  };
}
