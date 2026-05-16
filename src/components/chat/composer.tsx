"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Paperclip, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage } from "@/app/(app)/chat/actions";

export type ComposerTeamMember = {
  id: string;
  displayName: string;
};

export type ComposerProps = {
  channelId: string;
  currentUserId: string;
  currentDisplayName: string;
  currentAvatarUrl: string | null;
  teamMembers: ComposerTeamMember[];
};

type Attachment = {
  name: string;
  storage_path: string;
  size: number;
  mime_type: string;
};

export function Composer({
  channelId,
  currentUserId,
  currentDisplayName,
  currentAvatarUrl,
  teamMembers,
}: ComposerProps) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ----- mention autocomplete -----
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const mentionResults = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.trim().toLowerCase();
    const filtered = teamMembers.filter((m) =>
      q === "" ? true : m.displayName.toLowerCase().includes(q),
    );
    return filtered.slice(0, 5);
  }, [mentionOpen, mentionQuery, teamMembers]);

  // ----- helpers -----
  const dispatchAppend = useCallback(
    (payload: {
      id: string;
      body: string;
      created_at: string;
      sender_id: string;
      attachments: unknown;
      pending?: boolean;
    }) => {
      const stream = document.querySelector(
        `[data-chat-stream][data-channel-id="${channelId}"]`,
      );
      stream?.dispatchEvent(
        new CustomEvent("chat:append", { detail: payload }),
      );
    },
    [channelId],
  );

  const dispatchUpdate = useCallback(
    (tempId: string, patch: Record<string, unknown>) => {
      const stream = document.querySelector(
        `[data-chat-stream][data-channel-id="${channelId}"]`,
      );
      stream?.dispatchEvent(
        new CustomEvent("chat:update", { detail: { tempId, patch } }),
      );
    },
    [channelId],
  );

  const detectMention = useCallback((value: string, caret: number) => {
    // Find the start of a mention token before the caret.
    const slice = value.slice(0, caret);
    const match = slice.match(/(?:^|\s)@([\p{L}\p{N}_]*)$/u);
    if (match) {
      setMentionOpen(true);
      setMentionQuery(match[1] ?? "");
      setMentionStart(caret - (match[1]?.length ?? 0) - 1);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
    }
  }, []);

  const insertMention = useCallback(
    (member: ComposerTeamMember) => {
      const ta = textareaRef.current;
      if (!ta || mentionStart == null) return;
      const before = body.slice(0, mentionStart);
      const after = body.slice(ta.selectionStart);
      const insert = `@${member.displayName} `;
      const next = before + insert + after;
      setBody(next);
      setMentionOpen(false);
      setMentionStart(null);
      setMentionQuery("");
      // Restore focus + caret after state flush
      requestAnimationFrame(() => {
        ta.focus();
        const newCaret = before.length + insert.length;
        ta.setSelectionRange(newCaret, newCaret);
      });
    },
    [body, mentionStart],
  );

  // ----- send -----
  const send = useCallback(async () => {
    const trimmed = body.trim();
    if (trimmed.length === 0 || sending) return;
    setError(null);
    setSending(true);

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticBody = trimmed;
    const optimisticAttachments = attachments.slice();
    const now = new Date().toISOString();

    // Optimistic append
    dispatchAppend({
      id: tempId,
      body: optimisticBody,
      created_at: now,
      sender_id: currentUserId,
      attachments: optimisticAttachments,
      pending: true,
    });

    // Clear input immediately
    setBody("");
    setAttachments([]);
    setMentionOpen(false);
    setMentionStart(null);

    const result = await sendMessage({
      channel_id: channelId,
      body: optimisticBody,
      attachments: optimisticAttachments,
    });

    if ("error" in result) {
      setError(result.error);
      dispatchUpdate(tempId, { pending: false, failed: true });
      setSending(false);
      return;
    }

    // Replace temp id with real one
    dispatchUpdate(tempId, {
      id: result.id,
      created_at: result.created_at,
      pending: false,
      failed: false,
    });
    setSending(false);
  }, [
    body,
    sending,
    attachments,
    dispatchAppend,
    dispatchUpdate,
    currentUserId,
    channelId,
  ]);

  // ----- file upload -----
  const onPickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length === 0) return;
      setUploading(true);
      setError(null);

      const supabase = createClient();
      const uploaded: Attachment[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${currentUserId}/chat/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false });
        if (upErr) {
          setError(`העלאה נכשלה: ${file.name}`);
          continue;
        }
        uploaded.push({
          name: file.name,
          storage_path: path,
          size: file.size,
          mime_type: file.type || "application/octet-stream",
        });
      }

      setAttachments((prev) => [...prev, ...uploaded]);
      setUploading(false);
      // Reset input so picking the same file again still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [currentUserId],
  );

  // ----- keyboard -----
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen && mentionResults.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMentionIndex((i) => (i + 1) % mentionResults.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setMentionIndex(
            (i) => (i - 1 + mentionResults.length) % mentionResults.length,
          );
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setMentionOpen(false);
          return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          const m = mentionResults[mentionIndex];
          if (m) insertMention(m);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        void send();
      }
    },
    [mentionOpen, mentionResults, mentionIndex, insertMention, send],
  );

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [body]);

  const initial = currentDisplayName.slice(0, 1).toUpperCase();

  return (
    <div className="border-t border-slate-200 bg-white px-4 py-3">
      {attachments.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {attachments.map((att, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
            >
              <Paperclip className="h-3.5 w-3.5 text-slate-500" aria-hidden />
              <span className="max-w-40 truncate">{att.name}</span>
              <button
                type="button"
                onClick={() =>
                  setAttachments((prev) => prev.filter((_, j) => j !== i))
                }
                className="rounded-sm p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label={`הסר ${att.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative flex items-end gap-2">
        <div className="shrink-0">
          {currentAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentAvatarUrl}
              alt=""
              className="h-9 w-9 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initial}
            </div>
          )}
        </div>

        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              detectMention(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={onKeyDown}
            placeholder="כתוב הודעה... (Shift+Enter לשורה חדשה)"
            rows={1}
            className="block w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500"
          />

          {mentionOpen && mentionResults.length > 0 && (
            <ul
              role="listbox"
              className="absolute bottom-full mb-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg start-0"
            >
              {mentionResults.map((m, idx) => (
                <li
                  key={m.id}
                  role="option"
                  aria-selected={idx === mentionIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m);
                  }}
                  className={
                    idx === mentionIndex
                      ? "cursor-pointer bg-brand-50 px-3 py-1.5 text-sm text-brand-800"
                      : "cursor-pointer px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  }
                >
                  {m.displayName}
                </li>
              ))}
            </ul>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onFilesSelected}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />

        <button
          type="button"
          onClick={onPickFiles}
          disabled={uploading}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="צרף קובץ"
        >
          <Paperclip className="h-5 w-5" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => void send()}
          disabled={sending || body.trim().length === 0}
          className="rounded-lg bg-brand-500 p-2 text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="שלח"
        >
          <Send className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {uploading && (
        <div className="mt-2 text-xs text-slate-500">מעלה קבצים...</div>
      )}
      {error && (
        <div className="mt-2 text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}
