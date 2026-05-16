"use client";

import { useMemo, useState } from "react";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import {
  PRIORITY_LABELS_HE,
  PRIORITY_ORDER,
  STATUS_LABELS_HE,
  STATUS_ORDER,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import {
  TaskFormDialog,
  type PersonOption,
  type ProfileOption,
} from "@/components/tasks/task-form-dialog";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskDueDisplay } from "@/components/tasks/task-due-display";
import { cn } from "@/lib/utils";

type SortKey = "due" | "priority" | "title";

type Props = {
  tasks: Task[];
  profiles: ProfileOption[];
  people: PersonOption[];
  currentUserId: string;
};

export function TaskTable({ tasks, profiles, people, currentUserId }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>(
    "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("due");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );
  const personMap = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const filtered = useMemo(() => {
    let list = tasks;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter);
    }
    if (assigneeFilter !== "all") {
      list = list.filter((t) => t.assignee_id === assigneeFilter);
    }
    if (personFilter !== "all") {
      list = list.filter((t) => t.person_id === personFilter);
    }
    return [...list].sort(compare(sortKey));
  }, [tasks, query, statusFilter, priorityFilter, assigneeFilter, personFilter, sortKey]);

  function openCreate() {
    setEditingTask(null);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-3">
      <Toolbar
        query={query}
        onQuery={setQuery}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityFilter={setPriorityFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeFilter={setAssigneeFilter}
        personFilter={personFilter}
        onPersonFilter={setPersonFilter}
        profiles={profiles}
        people={people}
        onCreate={openCreate}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <SortableHeader
                label="כותרת"
                active={sortKey === "title"}
                onClick={() => setSortKey("title")}
              />
              <th className="px-3 py-3 text-start">אחראי</th>
              <th className="px-3 py-3 text-start">איש קשר</th>
              <SortableHeader
                label="תאריך יעד"
                active={sortKey === "due"}
                onClick={() => setSortKey("due")}
              />
              <th className="px-3 py-3 text-start">סטטוס</th>
              <SortableHeader
                label="עדיפות"
                active={sortKey === "priority"}
                onClick={() => setSortKey("priority")}
              />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-sm text-slate-500">
                  לא נמצאו משימות.
                </td>
              </tr>
            )}
            {filtered.map((task) => {
              const assignee = task.assignee_id
                ? profileMap.get(task.assignee_id) ?? null
                : null;
              const person = task.person_id
                ? personMap.get(task.person_id) ?? null
                : null;
              return (
                <tr
                  key={task.id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                >
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => openEdit(task)}
                      className="text-start font-medium text-slate-900 hover:text-brand-700"
                    >
                      {task.title}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    {assignee ? (
                      <AssigneeChip
                        name={assignee.name}
                        avatarUrl={assignee.avatar_url}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {person ? (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {person.name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <TaskDueDisplay
                      due_start={task.due_start}
                      due_end={task.due_end}
                      due_label={task.due_label}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    <PriorityIndicator priority={task.priority} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TaskFormDialog
        open={dialogOpen}
        mode={
          editingTask
            ? {
                kind: "edit",
                id: editingTask.id,
                canDelete: editingTask.owner_id === currentUserId,
              }
            : { kind: "create" }
        }
        initial={
          editingTask
            ? {
                title: editingTask.title,
                description: editingTask.description,
                due_start: editingTask.due_start,
                due_end: editingTask.due_end,
                due_label: editingTask.due_label,
                status: editingTask.status,
                priority: editingTask.priority,
                assignee_id: editingTask.assignee_id,
                person_id: editingTask.person_id,
                project_id: editingTask.project_id,
              }
            : undefined
        }
        profiles={profiles}
        people={people}
        onClose={() => setDialogOpen(false)}
        onSaved={() => {
          // Server actions already revalidate; the page will refresh.
        }}
      />
    </div>
  );
}

function Toolbar({
  query,
  onQuery,
  statusFilter,
  onStatusFilter,
  priorityFilter,
  onPriorityFilter,
  assigneeFilter,
  onAssigneeFilter,
  personFilter,
  onPersonFilter,
  profiles,
  people,
  onCreate,
}: {
  query: string;
  onQuery: (s: string) => void;
  statusFilter: "all" | TaskStatus;
  onStatusFilter: (s: "all" | TaskStatus) => void;
  priorityFilter: "all" | TaskPriority;
  onPriorityFilter: (p: "all" | TaskPriority) => void;
  assigneeFilter: string;
  onAssigneeFilter: (id: string) => void;
  personFilter: string;
  onPersonFilter: (id: string) => void;
  profiles: ProfileOption[];
  people: PersonOption[];
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="חיפוש משימה..."
          className="w-full rounded-lg border border-slate-200 bg-white py-1.5 ps-9 pe-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <select
        value={statusFilter}
        onChange={(e) => onStatusFilter(e.target.value as "all" | TaskStatus)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">כל הסטטוסים</option>
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS_HE[s]}
          </option>
        ))}
      </select>

      <select
        value={priorityFilter}
        onChange={(e) =>
          onPriorityFilter(e.target.value as "all" | TaskPriority)
        }
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">כל העדיפויות</option>
        {PRIORITY_ORDER.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS_HE[p]}
          </option>
        ))}
      </select>

      <select
        value={assigneeFilter}
        onChange={(e) => onAssigneeFilter(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">כל האחראים</option>
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={personFilter}
        onChange={(e) => onPersonFilter(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="all">כל אנשי הקשר</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onCreate}
        className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white hover:opacity-95"
      >
        <Plus className="h-4 w-4" />
        משימה
      </button>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-3 text-start">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5",
          active ? "text-brand-700" : "text-slate-500 hover:text-slate-700",
        )}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
}

function AssigneeChip({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  return (
    <span className="inline-flex items-center gap-2">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700">
          {initial}
        </span>
      )}
      <span className="truncate text-xs text-slate-700">{name}</span>
    </span>
  );
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  med: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-700",
};

function PriorityIndicator({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        PRIORITY_STYLE[priority],
      )}
    >
      {PRIORITY_LABELS_HE[priority]}
    </span>
  );
}

function compare(key: SortKey) {
  return (a: Task, b: Task) => {
    if (key === "title") {
      return a.title.localeCompare(b.title, "he");
    }
    if (key === "priority") {
      const order: Record<TaskPriority, number> = { high: 0, med: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    }
    // due: nulls last, then ascending
    const aKey = a.due_start ?? a.due_end ?? null;
    const bKey = b.due_start ?? b.due_end ?? null;
    if (aKey === null && bKey === null) return 0;
    if (aKey === null) return 1;
    if (bKey === null) return -1;
    return aKey.localeCompare(bKey);
  };
}
