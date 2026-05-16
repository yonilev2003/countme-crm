"use client";

// Cmd+K global command palette. Self-contained: mounts once at the app
// layout root, listens for Cmd+K / Ctrl+K, opens a modal with a debounced
// global search across people, tasks, documents and (optionally) datasets.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Users,
  CheckSquare,
  FileText,
  Database,
  Loader2,
  type LucideIcon,
} from "lucide-react";

type PersonHit = { id: string; name: string; company: string | null };
type TaskHit = { id: string; title: string; status: string };
type DocumentHit = { id: string; name: string };
type DatasetHit = { id: string; name: string };

type SearchResponse = {
  people: PersonHit[];
  tasks: TaskHit[];
  documents: DocumentHit[];
  datasets: DatasetHit[];
};

type ResultKind = "person" | "task" | "document" | "dataset";

type FlatResult = {
  key: string;
  kind: ResultKind;
  title: string;
  meta: string | null;
  href: string;
};

type Group = {
  kind: ResultKind;
  label: string;
  icon: LucideIcon;
  items: FlatResult[];
};

const DEBOUNCE_MS = 200;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fetchTokenRef = useRef(0);

  // Global Cmd+K / Ctrl+K toggle. Also closes with Escape *if open* —
  // the modal's own keydown handler covers that, but a global Escape is
  // harmless here.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isToggle =
        (e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey);
      if (isToggle) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Reset query/state when opening, and focus the input after the modal
  // mounts.
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setResults(null);
      setActiveIndex(0);
      // Defer to next paint so the input is in the DOM.
      const id = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  // Body scroll lock while open so background pages don't scroll behind
  // the modal.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounce the query (200ms) before firing the network request.
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  // Fire the search. Cancel-on-restart via a token so a slow earlier
  // response doesn't clobber a faster later one.
  useEffect(() => {
    if (!open) return;
    if (debouncedQuery.length === 0) {
      setResults(null);
      setLoading(false);
      return;
    }
    const token = ++fetchTokenRef.current;
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(async (r) => (r.ok ? ((await r.json()) as SearchResponse) : null))
      .then((data) => {
        if (token !== fetchTokenRef.current) return;
        setResults(data);
      })
      .catch(() => {
        if (token !== fetchTokenRef.current) return;
        setResults(null);
      })
      .finally(() => {
        if (token !== fetchTokenRef.current) return;
        setLoading(false);
      });
  }, [debouncedQuery, open]);

  // Build a flat list of results in the same order as the rendered
  // groups, so keyboard navigation can move through them with a single
  // index.
  const { groups, flat } = useMemo<{ groups: Group[]; flat: FlatResult[] }>(
    () => {
      if (!results) return { groups: [], flat: [] };

      const rawGroups: Group[] = [
        {
          kind: "person",
          label: "אנשי קשר",
          icon: Users,
          items: results.people.map((p) => ({
            key: `person-${p.id}`,
            kind: "person",
            title: p.name,
            meta: p.company,
            href: "/people",
          })),
        },
        {
          kind: "task",
          label: "משימות",
          icon: CheckSquare,
          items: results.tasks.map((t) => ({
            key: `task-${t.id}`,
            kind: "task",
            title: t.title,
            meta: labelForTaskStatus(t.status),
            href: "/tasks",
          })),
        },
        {
          kind: "document",
          label: "מסמכים",
          icon: FileText,
          items: results.documents.map((d) => ({
            key: `document-${d.id}`,
            kind: "document",
            title: d.name,
            meta: null,
            href: "/documents",
          })),
        },
        {
          kind: "dataset",
          label: "Datasets",
          icon: Database,
          items: results.datasets.map((d) => ({
            key: `dataset-${d.id}`,
            kind: "dataset",
            title: d.name,
            meta: null,
            href: "/dashboard",
          })),
        },
      ];

      const visibleGroups = rawGroups.filter((g) => g.items.length > 0);
      const flatList = visibleGroups.flatMap((g) => g.items);
      return { groups: visibleGroups, flat: flatList };
    },
    [results],
  );

  // Keep activeIndex in range as results change.
  useEffect(() => {
    if (activeIndex >= flat.length) setActiveIndex(0);
  }, [flat.length, activeIndex]);

  const close = useCallback(() => setOpen(false), []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  function onKeyDownInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = flat[activeIndex];
      if (sel) navigate(sel.href);
    }
  }

  if (!open) return null;

  const hasQuery = debouncedQuery.length > 0;
  const showEmpty =
    hasQuery && !loading && results !== null && flat.length === 0;
  const showHint = !hasQuery;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="חיפוש גלובלי"
      className="fixed inset-0 z-[100] flex justify-center bg-slate-900/40 px-4 pt-[15vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDownInput}
            placeholder="חיפוש אנשים, משימות, מסמכים..."
            className="flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          )}
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline-block">
            ESC
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {showHint && (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              התחל להקליד...
            </div>
          )}

          {showEmpty && (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              אין תוצאות ל־{debouncedQuery}
            </div>
          )}

          {!showHint &&
            !showEmpty &&
            groups.map((group) => {
              const Icon = group.icon;
              return (
                <div
                  key={group.kind}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center gap-1.5 bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <Icon className="h-3.5 w-3.5 text-brand-500" />
                    <span>{group.label}</span>
                  </div>
                  <div className="py-1">
                    {group.items.map((item) => {
                      const flatIdx = flat.findIndex((f) => f.key === item.key);
                      const active = flatIdx === activeIndex;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => navigate(item.href)}
                          className={
                            "flex w-full items-center gap-3 px-4 py-2 text-start " +
                            (active
                              ? "bg-brand-50 text-brand-900"
                              : "text-slate-800 hover:bg-slate-50")
                          }
                        >
                          <Icon
                            className={
                              "h-4 w-4 shrink-0 " +
                              (active ? "text-brand-600" : "text-slate-400")
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {item.title}
                            </div>
                            {item.meta && (
                              <div
                                className={
                                  "truncate text-xs " +
                                  (active ? "text-brand-700" : "text-slate-500")
                                }
                              >
                                {item.meta}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">
              ↑↓
            </kbd>
            <span>ניווט</span>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">
              ↵
            </kbd>
            <span>פתח</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">
              ⌘
            </kbd>
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold">
              K
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

function labelForTaskStatus(status: string): string {
  switch (status) {
    case "todo":
      return "לעשות";
    case "doing":
      return "בביצוע";
    case "done":
      return "הושלם";
    default:
      return status;
  }
}
