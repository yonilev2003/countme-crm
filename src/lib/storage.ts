// Helpers for the documents storage flow.
// Bucket: `documents` (private). Path convention: `{owner_id}/{ts}-{filename}`.

import type { SupabaseClient } from "@supabase/supabase-js";

const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Maps a MIME type to a lucide-react icon NAME. Components decide how to
 * render the actual icon based on this string.
 */
export function mimeIcon(mime: string): string {
  const m = (mime || "").toLowerCase();

  if (m.startsWith("image/")) return "Image";
  if (m === "application/pdf") return "FileText";
  if (
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "application/vnd.ms-excel" ||
    m === "text/csv"
  ) {
    return "FileSpreadsheet";
  }
  if (
    m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    m === "application/msword"
  ) {
    return "FileText";
  }
  if (
    m === "application/zip" ||
    m === "application/x-zip-compressed" ||
    m === "application/x-7z-compressed" ||
    m === "application/x-rar-compressed" ||
    m === "application/gzip" ||
    m === "application/x-tar"
  ) {
    return "FileArchive";
  }
  if (m.startsWith("video/")) return "FileVideo";
  if (m.startsWith("audio/")) return "FileAudio";
  if (
    m === "text/html" ||
    m === "text/css" ||
    m === "text/javascript" ||
    m === "application/javascript" ||
    m === "application/json" ||
    m === "application/xml" ||
    m === "text/xml"
  ) {
    return "FileCode";
  }
  if (m.startsWith("text/")) return "FileText";

  return "File";
}

/**
 * Hebrew-friendly size formatter. Uses base-1024 units with Hebrew unit names.
 */
export function humanSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 בייט";

  const units = ["בייט", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(k)),
  );
  const value = bytes / Math.pow(k, i);
  const rounded =
    i === 0 ? Math.round(value).toString() : value.toFixed(value >= 10 ? 1 : 2);
  return `${rounded} ${units[i]}`;
}

/**
 * Returns a short-lived signed URL for a stored object. Throws on error
 * so callers see meaningful failures instead of silent broken downloads.
 */
export async function getSignedDownloadUrl(
  supabase: SupabaseClient,
  storage_path: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storage_path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "לא ניתן ליצור קישור הורדה");
  }
  return data.signedUrl;
}

/**
 * Builds a storage path that satisfies both the bucket's RLS prefix policy
 * AND Supabase Storage's object-key validation, then prefixes a timestamp to
 * avoid collisions.
 *
 * NOTE: Storage keys are NOT Unicode-safe. The server validates keys against
 * roughly /^[\w/!\-.*'() &$@=;:+,?]*$/, where `\w` is ASCII-only — so Hebrew
 * (or any non-ASCII) letters trigger an "Invalid key" error on upload. The
 * key is therefore reduced to ASCII here; the original human-readable name
 * (Hebrew included) is preserved separately in `documents.name` for display.
 */
export function buildStoragePath(ownerId: string, filename: string): string {
  const safe = sanitizeFilename(filename);
  return `${ownerId}/${Date.now()}-${safe}`;
}

function sanitizeFilename(name: string): string {
  const trimmed = (name || "").trim();

  // Split off the extension so it survives even when the base name is
  // entirely non-ASCII (e.g. a fully-Hebrew filename).
  const dot = trimmed.lastIndexOf(".");
  const hasExt = dot > 0 && dot < trimmed.length - 1;
  const rawBase = hasExt ? trimmed.slice(0, dot) : trimmed;
  const rawExt = hasExt ? trimmed.slice(dot + 1) : "";

  // Keep only ASCII letters/digits/dot/underscore/hyphen; collapse every
  // other run (spaces, Hebrew, punctuation) to a single hyphen and trim
  // stray separators from the ends.
  const base = rawBase
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const ext = rawExt.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();

  const safeBase = base || "file";
  return ext ? `${safeBase}.${ext}` : safeBase;
}
