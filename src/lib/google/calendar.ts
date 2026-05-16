// Google Calendar REST API helpers. We hit the v3 API directly via fetch
// rather than pulling in the heavy googleapis client — it's a thin wrapper
// and gives us cleaner error handling for 410 Gone / 412 Precondition Failed.

const API_BASE = "https://www.googleapis.com/calendar/v3";
const TIME_ZONE = "Asia/Jerusalem";

/**
 * Thrown when Google returns 401 Unauthorized. Callers should refresh the
 * access token and retry once.
 */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export type GoogleAttendee = { email: string; responseStatus?: string };

export type GoogleEvent = {
  id?: string;
  etag?: string;
  status?: string; // "confirmed" | "tentative" | "cancelled"
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: GoogleAttendee[];
  updated?: string;
  htmlLink?: string;
};

export type ListEventsResult = {
  items: GoogleEvent[];
  nextSyncToken: string | null;
  nextPageToken: string | null;
  resetSyncToken: boolean; // true when Google returned 410 (sync token invalid)
};

export type EventPayload = {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  attendees?: GoogleAttendee[];
};

function ensureZone(payload: EventPayload): EventPayload {
  return {
    ...payload,
    start: { ...payload.start, timeZone: payload.start.timeZone ?? TIME_ZONE },
    end: { ...payload.end, timeZone: payload.end.timeZone ?? TIME_ZONE },
  };
}

async function gfetch(
  url: string,
  init: RequestInit & { accessToken: string },
): Promise<Response> {
  const { accessToken, ...rest } = init;
  return fetch(url, {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * List events from a calendar.
 *  - If `syncToken` is provided, returns incremental changes only.
 *  - If Google returns 410 Gone, signals via `resetSyncToken: true` so the
 *    caller can drop the stored token and do a full window resync.
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  opts: {
    syncToken?: string | null;
    timeMin?: string;
    timeMax?: string;
    pageToken?: string;
  } = {},
): Promise<ListEventsResult> {
  const url = new URL(`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
  url.searchParams.set("maxResults", "250");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("showDeleted", "true");

  if (opts.syncToken) {
    url.searchParams.set("syncToken", opts.syncToken);
  } else {
    // Full sync window — required if no syncToken. singleEvents + timeMin/Max
    // gives us a stable starting point Google will issue a fresh syncToken for.
    if (opts.timeMin) url.searchParams.set("timeMin", opts.timeMin);
    if (opts.timeMax) url.searchParams.set("timeMax", opts.timeMax);
    url.searchParams.set("orderBy", "startTime");
  }

  if (opts.pageToken) url.searchParams.set("pageToken", opts.pageToken);

  const res = await gfetch(url.toString(), { accessToken, method: "GET" });

  if (res.status === 410) {
    // Sync token expired — caller should reset and do a full sync.
    return {
      items: [],
      nextSyncToken: null,
      nextPageToken: null,
      resetSyncToken: true,
    };
  }
  if (res.status === 401) {
    throw new GoogleAuthError(`Calendar list 401`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar list failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    items?: GoogleEvent[];
    nextSyncToken?: string;
    nextPageToken?: string;
  };

  return {
    items: json.items ?? [],
    nextSyncToken: json.nextSyncToken ?? null,
    nextPageToken: json.nextPageToken ?? null,
    resetSyncToken: false,
  };
}

export type InsertResult = { ok: true; event: GoogleEvent } | { ok: false; status: number; text: string };
export type PatchResult =
  | { ok: true; event: GoogleEvent }
  | { ok: false; status: number; text: string; conflict: boolean }; // conflict=true on 412

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  payload: EventPayload,
): Promise<InsertResult> {
  const url = `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;
  const res = await gfetch(url, {
    accessToken,
    method: "POST",
    body: JSON.stringify(ensureZone(payload)),
  });

  if (res.status === 401) throw new GoogleAuthError("insertEvent 401");
  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text() };
  }
  const event = (await res.json()) as GoogleEvent;
  return { ok: true, event };
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  payload: Partial<EventPayload>,
  ifMatchEtag?: string,
): Promise<PatchResult> {
  const url = `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const body = payload.start && payload.end
    ? ensureZone(payload as EventPayload)
    : payload;

  const res = await gfetch(url, {
    accessToken,
    method: "PATCH",
    headers: ifMatchEtag ? { "If-Match": ifMatchEtag } : undefined,
    body: JSON.stringify(body),
  });

  if (res.status === 401) throw new GoogleAuthError("patchEvent 401");
  if (res.status === 412) {
    return {
      ok: false,
      status: 412,
      text: await res.text(),
      conflict: true,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      text: await res.text(),
      conflict: false,
    };
  }
  const event = (await res.json()) as GoogleEvent;
  return { ok: true, event };
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<{ ok: boolean; status: number; text?: string }> {
  const url = `${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const res = await gfetch(url, { accessToken, method: "DELETE" });
  if (res.status === 401) throw new GoogleAuthError("deleteEvent 401");
  if (res.status === 204 || res.status === 200 || res.status === 410 || res.status === 404) {
    return { ok: true, status: res.status };
  }
  return { ok: false, status: res.status, text: await res.text() };
}

/**
 * Resolves the email address for the calendar that owns the provided access
 * token. Used after the admin OAuth flow to record which Google account was
 * authorized as the shared team calendar.
 */
export async function getUserInfoEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { email?: string };
  return json.email ?? null;
}
