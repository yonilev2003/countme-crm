"use client";

import { formatDistanceToNow, format } from "date-fns";
import { he } from "date-fns/locale";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageItemSender = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MessageItemAttachment = {
  name?: string;
  storage_path?: string;
  size?: number;
  mime_type?: string;
};

export type MessageItemProps = {
  id: string;
  body: string;
  createdAt: string;
  sender: MessageItemSender;
  attachments?: MessageItemAttachment[];
  showHeader: boolean;
  pending?: boolean;
  failed?: boolean;
};

export function MessageItem({
  body,
  createdAt,
  sender,
  attachments,
  showHeader,
  pending,
  failed,
}: MessageItemProps) {
  const date = new Date(createdAt);
  const initial = sender.displayName.slice(0, 1).toUpperCase();
  const relative = formatDistanceToNow(date, { addSuffix: true, locale: he });
  const exact = format(date, "d בMMMM yyyy, HH:mm", { locale: he });

  return (
    <div
      className={cn(
        "group flex items-start gap-3 px-4 transition",
        showHeader ? "pt-3" : "pt-0.5",
      )}
    >
      <div className="w-9 shrink-0">
        {showHeader ? (
          sender.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sender.avatarUrl}
              alt=""
              className="h-9 w-9 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initial}
            </div>
          )
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-slate-900">
              {sender.displayName}
            </span>
            <time
              dateTime={date.toISOString()}
              title={exact}
              className="text-xs text-slate-500"
            >
              {relative}
            </time>
          </div>
        )}
        <div
          className={cn(
            "whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800",
            pending && "opacity-60",
            failed && "text-red-700",
          )}
        >
          {body}
        </div>
        {attachments && attachments.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {attachments.map((att, i) => (
              <li
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
              >
                <Paperclip className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                <span className="truncate">{att.name ?? "קובץ"}</span>
              </li>
            ))}
          </ul>
        )}
        {failed && (
          <div className="mt-1 text-xs text-red-600">שליחה נכשלה</div>
        )}
      </div>
    </div>
  );
}
