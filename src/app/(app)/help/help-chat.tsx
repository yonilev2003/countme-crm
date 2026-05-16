"use client";

import { useEffect, useRef, useState } from "react";
import { MessageSquareText, X, Send, Loader2, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; pending?: boolean };

const INITIAL_MESSAGE: Msg = {
  role: "assistant",
  content:
    "שלום! אני העוזר של מערכת הנהלת CountMe. שאל אותי איך לעשות כל דבר במערכת — למשל \"איך אני יוצר אירוע צוותי?\" או \"מה ההבדל בין ערוץ ציבורי לפרטי?\".",
};

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Msg = { role: "user", content: text };
    const assistantPlaceholder: Msg = {
      role: "assistant",
      content: "",
      pending: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg]
            .filter((m) => !m.pending)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].role === "assistant") {
            copy[lastIdx] = { role: "assistant", content: acc };
          }
          return copy;
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (lastIdx >= 0 && copy[lastIdx].role === "assistant") {
          copy[lastIdx] = {
            role: "assistant",
            content: "שגיאה בקבלת תשובה. נסה שוב.",
          };
        }
        return copy;
      });
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 end-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg ring-1 ring-brand-700/20 transition hover:bg-brand-600 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-brand-300"
        aria-label="שאל את העוזר"
        title="שאל את העוזר"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquareText className="h-6 w-6" />
        )}
      </button>

      {open && (
        <div
          className="fixed bottom-24 end-6 z-50 flex w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-96"
          role="dialog"
          aria-labelledby="help-chat-title"
          style={{ height: "min(600px, calc(100vh - 8rem))" }}
        >
          <header className="flex items-center gap-2 border-b border-slate-200 bg-brand-50 px-4 py-3">
            <Sparkles className="h-4 w-4 text-brand-700" />
            <h3
              id="help-chat-title"
              className="flex-1 font-display text-sm font-semibold text-brand-900"
            >
              עוזר הנהלת CountMe
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-1 text-brand-700 hover:bg-brand-100"
              aria-label="סגור"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="שאל שאלה..."
                disabled={sending}
                className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50"
                style={{ maxHeight: 120 }}
              />
              <button
                type="button"
                onClick={send}
                disabled={sending || input.trim().length === 0}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="שלח"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={
        "flex " + (isUser ? "justify-end" : "justify-start")
      }
    >
      <div
        className={
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed " +
          (isUser
            ? "bg-brand-500 text-white"
            : "bg-slate-100 text-slate-900")
        }
      >
        {msg.content || (msg.pending && <PendingDots />)}
      </div>
    </div>
  );
}

function PendingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="חושב...">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
    </span>
  );
}
