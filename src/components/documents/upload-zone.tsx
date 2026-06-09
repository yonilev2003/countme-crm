"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  FileIcon,
  Loader2,
  Cloud,
  CloudOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildStoragePath, humanSize } from "@/lib/storage";
import { createDocument } from "@/app/(app)/documents/actions";
import {
  LinkPicker,
  type LinkTarget,
  type PersonOption,
  type ProjectOption,
} from "./link-picker";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB to match next.config.ts bodySizeLimit

type ItemStatus = "uploading" | "done" | "error";
// Outcome of the synchronous Drive mirror reported by createDocument:
//   synced  — confirmed in the team Drive
//   failed  — saved locally, Drive upload failed (auto-retried in background)
//   skipped — Drive isn't connected, nothing to mirror
type DriveSync = "synced" | "failed" | "skipped";
type Item = {
  id: string;
  name: string;
  size: number;
  status: ItemStatus;
  message?: string;
  drive?: DriveSync;
};

type Props = {
  people: PersonOption[];
  projects: ProjectOption[];
};

// Uploads run in two phases: the client streams the bytes directly to the
// `documents` bucket in Supabase Storage (fast, avoids the 20MB server-action
// body limit), then calls the `createDocument` server action which writes the
// DB row AND fires a background Drive mirror upload (see actions.ts).
export function UploadZone({ people, projects }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [link, setLink] = useState<LinkTarget>({ kind: "none" });
  const [globalError, setGlobalError] = useState<string | null>(null);

  const updateItem = useCallback((id: string, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const uploadOne = useCallback(
    async (file: File, ownerId: string, supabase: ReturnType<typeof createClient>) => {
      const itemId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setItems((prev) => [
        ...prev,
        { id: itemId, name: file.name, size: file.size, status: "uploading" },
      ]);

      if (file.size > MAX_BYTES) {
        updateItem(itemId, {
          status: "error",
          message: `הקובץ גדול מ-${humanSize(MAX_BYTES)}`,
        });
        return;
      }

      const path = buildStoragePath(ownerId, file.name);
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (upErr) {
        updateItem(itemId, { status: "error", message: upErr.message });
        return;
      }

      const result = await createDocument({
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size: file.size,
        person_id: link.kind === "person" ? link.id : null,
        project_id: link.kind === "project" ? link.id : null,
      });

      if ("error" in result) {
        updateItem(itemId, { status: "error", message: result.error });
        return;
      }

      updateItem(itemId, {
        status: "done",
        drive: result.drive,
        message:
          result.drive === "failed"
            ? "נשמר. סנכרון ל-Drive נכשל — ינוסה שוב אוטומטית"
            : undefined,
      });
    },
    [link, updateItem],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setGlobalError(null);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setGlobalError("לא מחובר. רענן את העמוד והתחבר מחדש.");
        return;
      }

      const files = Array.from(fileList);
      // Upload in parallel; each row reports its own status.
      await Promise.all(files.map((f) => uploadOne(f, user.id, supabase)));

      router.refresh();
    },
    [router, uploadOne],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  function clearFinished() {
    setItems((prev) => prev.filter((it) => it.status === "uploading"));
  }

  const hasFinished = items.some((it) => it.status !== "uploading");

  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600">קישור ברירת מחדל למסמכים חדשים:</span>
        <LinkPicker
          people={people}
          projects={projects}
          value={link}
          onChange={setLink}
        />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={
          isDragging
            ? "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50 p-10 text-center transition"
            : "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center transition hover:border-brand-300 hover:bg-brand-50/50"
        }
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <CloudUpload className="h-7 w-7" />
        </div>
        <h2 className="mt-3 font-display text-lg font-bold text-slate-900">
          גרור קבצים לכאן או לחץ לבחירה
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          עד {humanSize(MAX_BYTES)} לקובץ. תמונות, PDF, מסמכים, גיליונות.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-700">
          <Cloud className="h-3.5 w-3.5" />
          קבצים שיועלו ייסונכרנו אוטומטית ל-Google Drive של הצוות
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {globalError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {globalError}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <div className="text-sm font-medium text-slate-900">
              קבצים ({items.length})
            </div>
            {hasFinished && (
              <button
                type="button"
                onClick={clearFinished}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                נקה רשימה
              </button>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <FileIcon className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">
                    {it.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {humanSize(it.size)}
                    {it.message ? (
                      <span
                        className={
                          it.status === "done" && it.drive === "failed"
                            ? "text-amber-700"
                            : undefined
                        }
                      >
                        {" · "}
                        {it.message}
                      </span>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={it.status} drive={it.drive} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  drive,
}: {
  status: ItemStatus;
  drive?: DriveSync;
}) {
  if (status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        מעלה...
      </span>
    );
  }
  if (status === "done") {
    // Drive upload failed: the file is saved locally and will be retried, so
    // signal it as a warning (amber) rather than a hard error.
    if (drive === "failed") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <CloudOff className="h-3.5 w-3.5" />
          נשמר, ללא Drive
        </span>
      );
    }
    if (drive === "synced") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Cloud className="h-3.5 w-3.5" />
          סונכרן ל-Drive
        </span>
      );
    }
    // drive "skipped"/undefined — Drive not connected; just confirm the save.
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        הועלה
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <AlertCircle className="h-3.5 w-3.5" />
      שגיאה
    </span>
  );
}
