"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2, RefreshCw, Wifi } from "lucide-react";
import { MonthView, type CalendarTile } from "@/components/calendar/month-view";
import {
  EventDialog,
  type DialogEvent,
  type DialogPerson,
  type DialogProfile,
  type DialogProject,
} from "@/components/calendar/event-dialog";
import { requestSync } from "./actions";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  kind: "personal" | "team";
  person_id: string | null;
  project_id: string | null;
  owner_id: string;
  attendee_profile_ids: string[];
};

type TaskRow = {
  id: string;
  title: string;
  due_start: string | null;
  due_end: string | null;
};

type Props = {
  currentUserId: string;
  isAdmin: boolean;
  events: EventRow[];
  tasks: TaskRow[];
  profiles: DialogProfile[];
  people: DialogPerson[];
  projects: DialogProject[];
};

type FilterKey = "personal" | "team" | "task";

export function CalendarShell({
  currentUserId,
  isAdmin,
  events,
  tasks,
  profiles,
  people,
  projects,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    personal: true,
    team: true,
    task: true,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DialogEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [autoSyncOn, setAutoSyncOn] = useState<boolean>(true);
  const autoSyncBusyRef = useRef(false);

  // Continuous background sync: on mount + every 60 seconds while tab is
  // visible. Non-blocking (uses no transition); silent unless events change.
  useEffect(() => {
    if (!autoSyncOn) return;

    let cancelled = false;

    async function runSilent() {
      if (autoSyncBusyRef.current) return;
      if (document.hidden) return;
      autoSyncBusyRef.current = true;
      try {
        const r = await requestSync("both");
        if (cancelled) return;
        setLastSyncAt(new Date());
        if (r.pulled + r.pushed + r.deleted > 0) {
          // Schema changed → revalidate via router.refresh so server-fetched
          // events re-render
          router.refresh();
        }
      } catch {
        // Swallow — auto-sync errors shouldn't toast.
      } finally {
        autoSyncBusyRef.current = false;
      }
    }

    runSilent();
    const intervalId = window.setInterval(runSilent, 60_000);
    const onVisibility = () => {
      if (!document.hidden) runSilent();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autoSyncOn, router]);

  function toggleFilter(k: FilterKey) {
    setFilters((prev) => ({ ...prev, [k]: !prev[k] }));
  }

  function openCreate(date?: Date | null) {
    setEditing(null);
    setDefaultDate(date ?? null);
    setDialogOpen(true);
  }

  function openEdit(id: string) {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    setEditing({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      start_at: ev.start_at,
      end_at: ev.end_at,
      kind: ev.kind,
      person_id: ev.person_id,
      project_id: ev.project_id,
      attendee_profile_ids: ev.attendee_profile_ids,
      owner_id: ev.owner_id,
    });
    setDefaultDate(null);
    setDialogOpen(true);
  }

  function handleSync() {
    setSyncMessage(null);
    setSyncError(null);
    startSync(async () => {
      const r = await requestSync("both");
      const errs = r.errors.length ? ` | שגיאות: ${r.errors.join("; ")}` : "";
      setSyncMessage(
        `נמשכו ${r.pulled}, נדחפו ${r.pushed}, נמחקו ${r.deleted}` +
          (r.conflicts ? `, ${r.conflicts} קונפליקטים` : "") +
          errs,
      );
      if (r.errors.length) setSyncError(r.errors.join("; "));
      setLastSyncAt(new Date());
      if (r.pulled + r.pushed + r.deleted > 0) router.refresh();
    });
  }

  const tiles: CalendarTile[] = useMemo(() => {
    const out: CalendarTile[] = [];

    for (const e of events) {
      if (e.kind === "personal" && !filters.personal) continue;
      if (e.kind === "team" && !filters.team) continue;
      out.push({
        id: e.id,
        title: e.title,
        start: e.start_at,
        end: e.end_at,
        kind: e.kind,
      });
    }

    if (filters.task) {
      for (const t of tasks) {
        if (!t.due_start) continue;
        // Tasks render as 1-hour tiles at 09:00 of due_start
        const start = new Date(`${t.due_start}T09:00:00`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        out.push({
          id: `task-${t.id}`,
          title: t.title,
          start: start.toISOString(),
          end: end.toISOString(),
          kind: "task",
        });
      }
    }

    return out;
  }, [events, tasks, filters]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            label="אישי"
            active={filters.personal}
            onClick={() => toggleFilter("personal")}
            tone="brand"
          />
          <FilterChip
            label="צוות"
            active={filters.team}
            onClick={() => toggleFilter("team")}
            tone="sky"
          />
          <FilterChip
            label="משימות"
            active={filters.task}
            onClick={() => toggleFilter("task")}
            tone="emerald"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoSyncOn((v) => !v)}
            title={
              autoSyncOn
                ? "סנכרון אוטומטי כל 60 שניות פעיל. לחץ להפסקה."
                : "סנכרון אוטומטי כבוי. לחץ להפעלה."
            }
            className={
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition " +
              (autoSyncOn
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50")
            }
            aria-pressed={autoSyncOn}
          >
            <Wifi className="h-3.5 w-3.5" />
            {autoSyncOn ? "סנכרון אוטומטי" : "אוטומטי כבוי"}
            {lastSyncAt && autoSyncOn && (
              <span className="text-emerald-700/70">
                · {lastSyncAt.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            סנכרן עכשיו
          </button>
          <button
            type="button"
            onClick={() => openCreate(null)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <CalendarPlus className="h-4 w-4" />
            אירוע חדש
          </button>
        </div>
      </div>

      {(syncMessage || syncError) && (
        <div
          className={
            "mb-3 rounded-lg px-3 py-2 text-sm " +
            (syncError
              ? "bg-red-50 text-red-800"
              : "bg-emerald-50 text-emerald-800")
          }
        >
          {syncMessage ?? syncError}
        </div>
      )}

      <MonthView
        events={tiles}
        currentMonth={currentMonth}
        onChangeMonth={setCurrentMonth}
        onSelectDate={(d) => openCreate(d)}
        onSelectEvent={(id) => {
          if (id.startsWith("task-")) return;
          openEdit(id);
        }}
      />

      <EventDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        initial={editing}
        defaultDate={defaultDate}
        profiles={profiles}
        people={people}
        projects={projects}
      />
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: "brand" | "sky" | "emerald";
}) {
  const toneCls = active
    ? tone === "brand"
      ? "bg-brand-100 text-brand-800 border-brand-200"
      : tone === "sky"
        ? "bg-sky-100 text-sky-800 border-sky-200"
        : "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50";
  return (
    <button
      type="button"
      onClick={onClick}
      className={"rounded-full border px-3 py-1.5 text-xs font-medium transition " + toneCls}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
