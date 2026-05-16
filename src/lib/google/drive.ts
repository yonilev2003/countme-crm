// Google Drive REST API helpers. Thin wrapper around v3 REST endpoints —
// we hit them directly via fetch instead of pulling in the heavyweight
// googleapis client, to keep bundle slim and error semantics explicit.
//
// Scope: drive.file — gives the app access ONLY to files the app creates.
// Non-sensitive scope (no Google verification banner). Combined with the
// auto-created root folder we manage, the app fully controls its own files
// without ever touching the user's other Drive content.

import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "./oauth";

const API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_CACHE_TTL_SECONDS = 55 * 60; // 55 min — matches oauth.ts convention
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh when < 5 min remaining

const FILE_FIELDS =
  "id, name, mimeType, size, modifiedTime, webViewLink, parents, trashed";

/**
 * Thrown when Google returns 401 Unauthorized. Callers should refresh the
 * access token and retry once. Mirrors the calendar.ts pattern.
 */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string; // Drive returns bytes as a string for files; absent for folders/Google-native
  modifiedTime: string; // ISO
  webViewLink?: string;
  parents?: string[];
  trashed?: boolean;
};

// ============================================================
// Token helpers
// ============================================================

function isStillValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs - Date.now() > REFRESH_THRESHOLD_MS;
}

function newExpiresAt(): string {
  return new Date(Date.now() + TOKEN_CACHE_TTL_SECONDS * 1000).toISOString();
}

/**
 * Returns a valid Google Drive access token for the shared team Drive account
 * (countme5555@gmail.com). Refresh token lives in `team_config` (singleton id=1).
 * Throws if the team Drive was never connected by an admin.
 */
export async function getValidAccessTokenForTeamDrive(
  supabase: SupabaseClient,
  force = false,
): Promise<string> {
  const { data: cfg, error } = await supabase
    .from("team_config")
    .select(
      "shared_drive_refresh_token, shared_drive_access_token, shared_drive_token_expires_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load team_config: ${error.message}`);
  if (!cfg?.shared_drive_refresh_token) {
    throw new Error(
      "Team Drive not connected; admin must connect via /admin/drive",
    );
  }

  if (
    !force &&
    cfg.shared_drive_access_token &&
    isStillValid(cfg.shared_drive_token_expires_at)
  ) {
    return cfg.shared_drive_access_token;
  }

  const refreshed = await refreshAccessToken(cfg.shared_drive_refresh_token);
  const expiresAt = newExpiresAt();

  const { error: upErr } = await supabase
    .from("team_config")
    .update({
      shared_drive_access_token: refreshed.access_token,
      shared_drive_token_expires_at: expiresAt,
    })
    .eq("id", 1);

  if (upErr) {
    // Non-fatal: we still got a working access token, just couldn't cache it.
    console.warn(
      "Failed to cache refreshed Drive access token:",
      upErr.message,
    );
  }

  return refreshed.access_token;
}

// ============================================================
// REST helpers
// ============================================================

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
    },
  });
}

async function throwOnHttp(res: Response, label: string): Promise<never> {
  const text = await res.text();
  throw new Error(`${label} failed (${res.status}): ${text.slice(0, 300)}`);
}

/**
 * Returns the email of the Drive account that owns the given access token.
 * Used in the admin OAuth callback to confirm we connected the right account.
 */
export async function getUserInfoEmail(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { email?: string };
  return json.email ?? null;
}

/**
 * List the contents of a Drive folder (one page). Only files we have access
 * to under the drive.file scope show up. Pagination is handled by callers via
 * the returned `nextPageToken`.
 */
export async function listFolderContents(
  accessToken: string,
  folderId: string,
  pageToken?: string,
): Promise<{ files: DriveFile[]; nextPageToken: string | null }> {
  const url = new URL(`${API_BASE}/files`);
  // The drive.file scope already restricts us to app-created files, so an
  // explicit parents filter is the natural way to scope to our root folder.
  // We also include trashed files so we can detect Drive-side deletions.
  url.searchParams.set("q", `'${folderId}' in parents`);
  url.searchParams.set("pageSize", "200");
  url.searchParams.set("fields", `nextPageToken, files(${FILE_FIELDS})`);
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("orderBy", "modifiedTime desc");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await gfetch(url.toString(), { accessToken, method: "GET" });

  if (res.status === 401) throw new GoogleAuthError("Drive list 401");
  if (!res.ok) await throwOnHttp(res, "Drive list");

  const json = (await res.json()) as {
    files?: DriveFile[];
    nextPageToken?: string;
  };
  return {
    files: json.files ?? [],
    nextPageToken: json.nextPageToken ?? null,
  };
}

/**
 * Creates a Drive folder. When `parentId` is omitted the folder is created
 * at the root of My Drive (still scoped to drive.file — i.e. only visible to
 * our app, but the user will see it in their Drive UI).
 */
export async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<DriveFile> {
  const url = new URL(`${API_BASE}/files`);
  url.searchParams.set("fields", FILE_FIELDS);

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) metadata.parents = [parentId];

  const res = await gfetch(url.toString(), {
    accessToken,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (res.status === 401) throw new GoogleAuthError("Drive createFolder 401");
  if (!res.ok) await throwOnHttp(res, "Drive createFolder");

  return (await res.json()) as DriveFile;
}

/**
 * Uploads a file to the given folder via multipart upload. Returns the
 * resulting DriveFile metadata. We use multipart (not resumable) since files
 * are capped at 20 MB.
 */
export async function uploadFile(
  accessToken: string,
  folderId: string,
  name: string,
  mimeType: string,
  contentBlob: Blob | Buffer | ArrayBuffer,
): Promise<DriveFile> {
  const boundary = `boundary-${crypto.randomUUID()}`;
  const metadata = {
    name,
    parents: [folderId],
    mimeType,
  };

  const encoder = new TextEncoder();
  const metaPart =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  // Normalize the body to a single Uint8Array for a clean Content-Length.
  let bodyBytes: Uint8Array;
  if (contentBlob instanceof Blob) {
    bodyBytes = new Uint8Array(await contentBlob.arrayBuffer());
  } else if (contentBlob instanceof ArrayBuffer) {
    bodyBytes = new Uint8Array(contentBlob);
  } else {
    // Buffer (Node)
    bodyBytes = new Uint8Array(
      contentBlob.buffer,
      contentBlob.byteOffset,
      contentBlob.byteLength,
    );
  }

  const metaBytes = encoder.encode(metaPart);
  const closingBytes = encoder.encode(closing);

  const merged = new Uint8Array(
    metaBytes.byteLength + bodyBytes.byteLength + closingBytes.byteLength,
  );
  merged.set(metaBytes, 0);
  merged.set(bodyBytes, metaBytes.byteLength);
  merged.set(closingBytes, metaBytes.byteLength + bodyBytes.byteLength);

  const url = new URL(`${UPLOAD_BASE}/files`);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("fields", FILE_FIELDS);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: merged,
  });

  if (res.status === 401) throw new GoogleAuthError("Drive upload 401");
  if (!res.ok) await throwOnHttp(res, "Drive upload");

  return (await res.json()) as DriveFile;
}

/**
 * Fetches metadata for a single file. Returns null on 404 so callers can
 * distinguish "gone" from a hard error.
 */
export async function getFile(
  accessToken: string,
  fileId: string,
): Promise<DriveFile | null> {
  const url = new URL(`${API_BASE}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("fields", FILE_FIELDS);

  const res = await gfetch(url.toString(), { accessToken, method: "GET" });

  if (res.status === 404) return null;
  if (res.status === 401) throw new GoogleAuthError("Drive getFile 401");
  if (!res.ok) await throwOnHttp(res, "Drive getFile");

  return (await res.json()) as DriveFile;
}

/**
 * Downloads the raw bytes of a Drive file. Only works for binary/uploaded
 * files — Google-native types (Docs/Sheets) have no `?alt=media` content and
 * would require `files.export`. Returns null on 404.
 */
export async function downloadFile(
  accessToken: string,
  fileId: string,
): Promise<{ data: ArrayBuffer; mimeType: string } | null> {
  const url = new URL(`${API_BASE}/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");

  const res = await gfetch(url.toString(), { accessToken, method: "GET" });

  if (res.status === 404) return null;
  if (res.status === 401) throw new GoogleAuthError("Drive download 401");
  if (!res.ok) await throwOnHttp(res, "Drive download");

  const mimeType = res.headers.get("Content-Type") ?? "application/octet-stream";
  const data = await res.arrayBuffer();
  return { data, mimeType };
}

/**
 * Soft-deletes a file by sending it to the user's Drive trash. Returns true
 * for 200/204/404 (file already gone is treated as success).
 */
export async function trashFile(
  accessToken: string,
  fileId: string,
): Promise<boolean> {
  const url = new URL(`${API_BASE}/files/${encodeURIComponent(fileId)}`);
  // PATCH with trashed=true is the canonical "delete to trash" call.
  const res = await gfetch(url.toString(), {
    accessToken,
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });

  if (res.status === 401) throw new GoogleAuthError("Drive trash 401");
  if (res.status === 404 || res.ok) return true;

  const text = await res.text();
  console.warn(`Drive trashFile failed (${res.status}): ${text.slice(0, 200)}`);
  return false;
}
