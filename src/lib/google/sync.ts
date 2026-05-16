// Bidirectional Google Calendar sync engine. Idempotent — running it twice
// in a row is a no-op the second time. Used for both the per-user personal
// calendar and the shared team calendar.
//
// Conflict resolution strategy:
//  - Local → Remote: rows where local_etag != google_etag (or where there is
//    no google_event_id yet) are pushed up. On PATCH we send If-Match: google_etag.
//  - Remote → Local: every pulled event overwrites the local row (Google wins
//    on 412 Precondition Failed; if our etag is stale, the next pull picks up
//    the truth).
//  - Sync token: stored per-source. On 410 Gone we drop it and do a full
//    window resync (timeMin = now-30d, timeMax = now+365d).

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getValidAccessTokenForTeam,
  getValidAccessTokenForUser,
} from "./oauth";
import {
  GoogleAuthError,
  insertEvent,
  listEvents,
  patchEvent,
  type EventPayload,
  type GoogleEvent,
} from "./calendar";

export type SyncKind = "personal" | "team";

export type SyncResult = {
  kind: SyncKind;
  pulled: number;
  pushed: number;
  deleted: number;
  conflicts: number;
  fullResync: boolean;
};

const PRIMARY_CALENDAR_ID = "primary";
const FULL_SYNC_PAST_DAYS = 30;
const FULL_SYNC_FUTURE_DAYS = 365;

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service role env vars");
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function nowMinusDays(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function nowPlusDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function googleStartEnd(evt: GoogleEvent): { start_at: string; end_at: string } | null {
  const startStr = evt.start?.dateTime ?? evt.start?.date;
  const endStr = evt.end?.dateTime ?? evt.end?.date;
  if (!startStr || !endStr) return null;
  return {
    start_at: new Date(startStr).toISOString(),
    end_at: new Date(endStr).toISOString(),
  };
}

function eventPayloadFromRow(row: {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  attendees?: { email: string }[];
}): EventPayload {
  return {
    summary: row.title,
    description: row.description ?? undefined,
    start: { dateTime: new Date(row.start_at).toISOString() },
    end: { dateTime: new Date(row.end_at).toISOString() },
    attendees: row.attendees?.length ? row.attendees : undefined,
  };
}

/**
 * Pulls remote changes into local DB. Returns counts and whether a 410 forced
 * a full resync.
 */
async function pullFromGoogle(
  db: SupabaseClient,
  accessToken: string,
  storedSyncToken: string | null,
  kind: SyncKind,
  ownerId: string,
): Promise<{
  pulled: number;
  deleted: number;
  fullResync: boolean;
  nextSyncToken: string | null;
}> {
  let pulled = 0;
  let deleted = 0;
  let fullResync = false;
  let nextSyncToken: string | null = storedSyncToken ?? null;

  let pageToken: string | undefined;
  let useSyncToken: string | null = storedSyncToken;

  while (true) {
    const res = await listEvents(accessToken, PRIMARY_CALENDAR_ID, {
      syncToken: useSyncToken,
      pageToken,
      timeMin: useSyncToken ? undefined : nowMinusDays(FULL_SYNC_PAST_DAYS),
      timeMax: useSyncToken ? undefined : nowPlusDays(FULL_SYNC_FUTURE_DAYS),
    });

    if (res.resetSyncToken) {
      // 410 Gone — drop token and restart with full window.
      useSyncToken = null;
      fullResync = true;
      pageToken = undefined;
      continue;
    }

    for (const evt of res.items) {
      if (!evt.id) continue;

      if (evt.status === "cancelled") {
        // Remote deletion — drop local copy.
        const { data: existing } = await db
          .from("events")
          .select("id")
          .eq("google_event_id", evt.id)
          .maybeSingle();
        if (existing?.id) {
          const { error: delErr } = await db
            .from("events")
            .delete()
            .eq("id", existing.id);
          if (!delErr) deleted += 1;
        }
        continue;
      }

      const times = googleStartEnd(evt);
      if (!times) continue;

      const { data: existing } = await db
        .from("events")
        .select("id, owner_id, local_etag, google_etag")
        .eq("google_event_id", evt.id)
        .maybeSingle();

      // If we have unpushed local edits (local_etag drifted from google_etag)
      // skip the overwrite — the upcoming push pass will reconcile.
      if (
        existing &&
        existing.local_etag &&
        existing.google_etag &&
        existing.local_etag !== existing.google_etag
      ) {
        continue;
      }

      const upsertRow = {
        title: evt.summary ?? "(ללא כותרת)",
        description: evt.description ?? null,
        start_at: times.start_at,
        end_at: times.end_at,
        google_event_id: evt.id,
        google_etag: evt.etag ?? null,
        local_etag: evt.etag ?? null, // mark as in-sync
        kind,
        local_updated_at: new Date().toISOString(),
      };

      if (existing?.id) {
        await db.from("events").update(upsertRow).eq("id", existing.id);
      } else {
        await db.from("events").insert({
          ...upsertRow,
          owner_id: ownerId,
        });
      }
      pulled += 1;

      // Attendees only synced for team events (per spec, keep personal simpler).
      if (kind === "team" && evt.attendees?.length) {
        await syncAttendeesForGoogleEvent(db, evt.id, evt.attendees);
      }
    }

    pageToken = res.nextPageToken ?? undefined;
    if (res.nextSyncToken) nextSyncToken = res.nextSyncToken;

    if (!pageToken) break;
  }

  return { pulled, deleted, fullResync, nextSyncToken };
}

async function syncAttendeesForGoogleEvent(
  db: SupabaseClient,
  googleEventId: string,
  attendees: { email: string; responseStatus?: string }[],
) {
  const { data: ev } = await db
    .from("events")
    .select("id")
    .eq("google_event_id", googleEventId)
    .maybeSingle();
  if (!ev?.id) return;

  // Map Google attendee emails → known profile ids
  const emails = attendees.map((a) => a.email.toLowerCase()).filter(Boolean);
  if (!emails.length) return;

  const { data: profiles } = await db
    .from("profiles")
    .select("id, email")
    .in("email", emails);
  if (!profiles?.length) return;

  const byEmail = new Map(profiles.map((p) => [p.email?.toLowerCase(), p.id]));

  const rows = attendees
    .map((a) => {
      const profileId = byEmail.get(a.email.toLowerCase());
      if (!profileId) return null;
      const response =
        a.responseStatus === "accepted"
          ? "accepted"
          : a.responseStatus === "declined"
            ? "declined"
            : "pending";
      return { event_id: ev.id, profile_id: profileId, response };
    })
    .filter((r): r is { event_id: string; profile_id: string; response: string } => !!r);

  if (!rows.length) return;

  // Upsert. event_attendees PK = (event_id, profile_id).
  await db.from("event_attendees").upsert(rows, {
    onConflict: "event_id,profile_id",
  });
}

/**
 * Pushes locally-modified events up to Google. A row needs pushing when:
 *  - It has no google_event_id yet (newly created locally) → INSERT
 *  - Its local_etag !== google_etag (locally modified after last sync) → PATCH
 */
async function pushToGoogle(
  db: SupabaseClient,
  accessToken: string,
  kind: SyncKind,
  ownerId: string,
): Promise<{ pushed: number; conflicts: number }> {
  let pushed = 0;
  let conflicts = 0;

  // Local-only inserts: no google_event_id at all.
  // For personal sync, scope to events owned by this user. For team sync, all
  // kind='team' rows belong to the shared calendar regardless of which admin
  // created them.
  const insertBase = db
    .from("events")
    .select("id, title, description, start_at, end_at, google_event_id, google_etag, local_etag")
    .eq("kind", kind)
    .is("google_event_id", null);
  const insertQuery = kind === "personal" ? insertBase.eq("owner_id", ownerId) : insertBase;
  const { data: pendingInsert } = await insertQuery;

  for (const row of pendingInsert ?? []) {
    const attendeeEmails = await loadAttendeeEmails(db, row.id);
    const result = await insertEvent(accessToken, PRIMARY_CALENDAR_ID, {
      ...eventPayloadFromRow({ ...row, attendees: attendeeEmails }),
    });
    if (!result.ok) {
      console.warn("insertEvent failed", result.status, result.text);
      continue;
    }
    await db
      .from("events")
      .update({
        google_event_id: result.event.id ?? null,
        google_etag: result.event.etag ?? null,
        local_etag: result.event.etag ?? null,
      })
      .eq("id", row.id);
    pushed += 1;
  }

  // Local edits: have google_event_id, but local_etag drifted from google_etag.
  const updateBase = db
    .from("events")
    .select("id, title, description, start_at, end_at, google_event_id, google_etag, local_etag")
    .eq("kind", kind)
    .not("google_event_id", "is", null);

  const updateQuery = kind === "personal" ? updateBase.eq("owner_id", ownerId) : updateBase;
  const { data: pendingUpdate } = await updateQuery;

  for (const row of pendingUpdate ?? []) {
    // Skip if already in sync
    if (row.local_etag && row.local_etag === row.google_etag) continue;
    if (!row.google_event_id) continue;

    const attendeeEmails = await loadAttendeeEmails(db, row.id);
    const result = await patchEvent(
      accessToken,
      PRIMARY_CALENDAR_ID,
      row.google_event_id,
      eventPayloadFromRow({ ...row, attendees: attendeeEmails }),
      row.google_etag ?? undefined,
    );

    if (result.ok) {
      await db
        .from("events")
        .update({
          google_etag: result.event.etag ?? null,
          local_etag: result.event.etag ?? null,
        })
        .eq("id", row.id);
      pushed += 1;
    } else if (result.conflict) {
      // 412: Google has newer version → mark stale; next pull will overwrite.
      await db
        .from("events")
        .update({ local_etag: null })
        .eq("id", row.id);
      conflicts += 1;
    } else {
      console.warn("patchEvent failed", result.status, result.text);
    }
  }

  return { pushed, conflicts };
}

async function loadAttendeeEmails(
  db: SupabaseClient,
  eventId: string,
): Promise<{ email: string }[]> {
  const { data } = await db
    .from("event_attendees")
    .select("profile_id, profiles!inner(email)")
    .eq("event_id", eventId);
  if (!data) return [];
  type Row = { profiles: { email?: string | null } | { email?: string | null }[] };
  return (data as unknown as Row[])
    .map((r) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return p?.email ? { email: p.email } : null;
    })
    .filter((x): x is { email: string } => !!x);
}

/**
 * Sync the personal calendar for a single user. Implements one-shot retry on
 * 401 (GoogleAuthError) by forcing an access-token refresh and re-running.
 */
export async function syncPersonal(
  userId: string,
  userSupabase: SupabaseClient,
): Promise<SyncResult> {
  let force = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await syncPersonalOnce(userId, userSupabase, force);
    } catch (err) {
      if (err instanceof GoogleAuthError && attempt === 0) {
        force = true; // refresh token and retry once
        continue;
      }
      throw err;
    }
  }
  throw new Error("syncPersonal: exhausted retries");
}

async function syncPersonalOnce(
  userId: string,
  userSupabase: SupabaseClient,
  forceRefresh: boolean,
): Promise<SyncResult> {
  const accessToken = await getValidAccessTokenForUser(
    userSupabase,
    userId,
    forceRefresh,
  );
  const db = adminClient();

  const { data: profile } = await db
    .from("profiles")
    .select("google_calendar_sync_token")
    .eq("id", userId)
    .maybeSingle();
  const storedSyncToken = profile?.google_calendar_sync_token ?? null;

  // Pull first so we have latest etags before pushing.
  const pull = await pullFromGoogle(db, accessToken, storedSyncToken, "personal", userId);
  const push = await pushToGoogle(db, accessToken, "personal", userId);

  if (pull.nextSyncToken) {
    await db
      .from("profiles")
      .update({ google_calendar_sync_token: pull.nextSyncToken })
      .eq("id", userId);
  } else if (pull.fullResync) {
    await db
      .from("profiles")
      .update({ google_calendar_sync_token: null })
      .eq("id", userId);
  }

  return {
    kind: "personal",
    pulled: pull.pulled,
    pushed: push.pushed,
    deleted: pull.deleted,
    conflicts: push.conflicts,
    fullResync: pull.fullResync,
  };
}

/**
 * Sync the shared team calendar. Team events have owner_id set to the admin
 * who connected the calendar (or the most-recently authenticated admin) — but
 * for kind='team' the sync engine treats ownership as the connecting admin.
 *
 * One-shot retry on 401 by forcing an access-token refresh.
 */
export async function syncTeam(
  callerUserId: string,
): Promise<SyncResult> {
  let force = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await syncTeamOnce(callerUserId, force);
    } catch (err) {
      if (err instanceof GoogleAuthError && attempt === 0) {
        force = true;
        continue;
      }
      throw err;
    }
  }
  throw new Error("syncTeam: exhausted retries");
}

async function syncTeamOnce(
  callerUserId: string,
  forceRefresh: boolean,
): Promise<SyncResult> {
  const db = adminClient();

  // For team events created remotely (no local row yet), we need an owner_id.
  // Use the calling admin; falls back to the first admin in the system.
  const { data: callerProfile } = await db
    .from("profiles")
    .select("id, is_admin")
    .eq("id", callerUserId)
    .maybeSingle();

  let ownerId = callerUserId;
  if (!callerProfile?.is_admin) {
    const { data: anyAdmin } = await db
      .from("profiles")
      .select("id")
      .eq("is_admin", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!anyAdmin?.id) {
      throw new Error("No admin found to own team events");
    }
    ownerId = anyAdmin.id;
  }

  const accessToken = await getValidAccessTokenForTeam(db, forceRefresh);

  const { data: cfg } = await db
    .from("team_config")
    .select("shared_calendar_sync_token")
    .eq("id", 1)
    .maybeSingle();
  const storedSyncToken = cfg?.shared_calendar_sync_token ?? null;

  const pull = await pullFromGoogle(db, accessToken, storedSyncToken, "team", ownerId);
  const push = await pushToGoogle(db, accessToken, "team", ownerId);

  if (pull.nextSyncToken) {
    await db
      .from("team_config")
      .update({ shared_calendar_sync_token: pull.nextSyncToken })
      .eq("id", 1);
  } else if (pull.fullResync) {
    await db
      .from("team_config")
      .update({ shared_calendar_sync_token: null })
      .eq("id", 1);
  }

  return {
    kind: "team",
    pulled: pull.pulled,
    pushed: push.pushed,
    deleted: pull.deleted,
    conflicts: push.conflicts,
    fullResync: pull.fullResync,
  };
}
