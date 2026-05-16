"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Trash2,
  File as FileGeneric,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
  Image as ImageIcon,
  User,
  Briefcase,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { humanSize, mimeIcon, getSignedDownloadUrl } from "@/lib/storage";
import { deleteDocument, getDownloadUrl } from "@/app/(app)/documents/actions";

export type DocumentRow = {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size: number | null;
  person_id: string | null;
  project_id: string | null;
  owner_id: string;
  uploaded_at: string;
};

export type OwnerInfo = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Props = {
  doc: DocumentRow;
  owner: OwnerInfo | null;
  currentUserId: string | null;
  personName: string | null;
  projectName: string | null;
};

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  File: FileGeneric,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  FileVideo,
  FileAudio,
  Image: ImageIcon,
};

export function DocumentCard({
  doc,
  owner,
  currentUserId,
  personName,
  projectName,
}: Props) {
  const router = useRouter();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isImage = (doc.mime_type ?? "").startsWith("image/");

  // Fetch a short-lived signed URL for the thumbnail. Stays in component
  // state so the broken-link state can fall back to the icon view.
  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const url = await getSignedDownloadUrl(supabase, doc.storage_path);
        if (!cancelled) setThumbUrl(url);
      } catch {
        if (!cancelled) setThumbUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isImage, doc.storage_path]);

  const iconName = mimeIcon(doc.mime_type ?? "");
  const Icon = ICON_MAP[iconName] ?? FileGeneric;

  const ownerName =
    owner?.display_name ?? owner?.full_name ?? owner?.email ?? "—";
  const uploadedAgo = (() => {
    try {
      return formatDistanceToNow(new Date(doc.uploaded_at), {
        addSuffix: true,
        locale: he,
      });
    } catch {
      return "";
    }
  })();

  const isOwner = currentUserId !== null && currentUserId === doc.owner_id;

  async function handleDownload() {
    setActionError(null);
    setDownloading(true);
    try {
      const result = await getDownloadUrl(doc.id);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      // open in a new tab; browser uses Content-Disposition from Storage
      window.open(result.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  function handleDelete() {
    if (!isOwner) return;
    const confirmed = window.confirm(`למחוק את "${doc.name}"?`);
    if (!confirmed) return;

    setActionError(null);
    startTransition(async () => {
      const result = await deleteDocument(doc.id);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-sm">
      <div className="relative aspect-[4/3] w-full bg-brand-50">
        {isImage && thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={doc.name}
            className="h-full w-full object-cover"
            onError={() => setThumbUrl(null)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon className="h-14 w-14 text-brand-500" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 flex items-end justify-center gap-2 bg-gradient-to-t from-black/55 via-black/0 to-black/0 p-3 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            aria-label="הורד מסמך"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "מכין..." : "הורד"}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              aria-label="מחק מסמך"
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-red-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {pending ? "מוחק..." : "מחק"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div
          className="truncate text-sm font-semibold text-slate-900"
          title={doc.name}
        >
          {doc.name}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span>{humanSize(doc.size ?? 0)}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{ownerName}</span>
        </div>
        {uploadedAgo && (
          <div className="text-xs text-slate-400">{uploadedAgo}</div>
        )}

        {(personName || projectName) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {personName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                <User className="h-3 w-3" />
                {personName}
              </span>
            )}
            {projectName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">
                <Briefcase className="h-3 w-3" />
                {projectName}
              </span>
            )}
          </div>
        )}

        {actionError && (
          <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            {actionError}
          </div>
        )}
      </div>
    </div>
  );
}
