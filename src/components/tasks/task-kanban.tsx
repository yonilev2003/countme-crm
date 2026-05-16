"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  PRIORITY_LABELS_HE,
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
import { TaskDueDisplay } from "@/components/tasks/task-due-display";
import { cn } from "@/lib/utils";

type Props = {
  tasks: Task[];
  profiles: ProfileOption[];
  people: PersonOption[];
  currentUserId: string;
};

export function TaskKanban({ tasks, profiles, people, currentUserId }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creatingStatus, setCreatingStatus] = useState<TaskStatus>("todo");

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] };
    for (const t of tasks) map[t.status].push(t);
    for (const s of STATUS_ORDER) map[s].sort(compareTasks);
    return map;
  }, [tasks]);

  function openCreate(status: TaskStatus) {
    setEditingTask(null);
    setCreatingStatus(status);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={grouped[status]}
            profileMap={profileMap}
            onCreate={status === "todo" ? () => openCreate(status) : undefined}
            onEdit={openEdit}
          />
        ))}
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
            : { status: creatingStatus }
        }
        profiles={profiles}
        people={people}
        onClose={() => setDialogOpen(false)}
      />
    </div>
  );
}

function Column({
  status,
  tasks,
  profileMap,
  onCreate,
  onEdit,
}: {
  status: TaskStatus;
  tasks: Task[];
  profileMap: Map<string, ProfileOption>;
  onCreate?: () => void;
  onEdit: (t: Task) => void;
}) {
  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          {STATUS_LABELS_HE[status]}
          <span className="ms-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-200 px-1.5 text-[11px] font-medium text-slate-700">
            {tasks.length}
          </span>
        </h3>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-medium text-brand-700 ring-1 ring-slate-200 hover:bg-brand-50"
          >
            <Plus className="h-3.5 w-3.5" />
            משימה
          </button>
        )}
      </header>

      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
            אין משימות
          </div>
        )}
        {tasks.map((task) => {
          const assignee = task.assignee_id
            ? profileMap.get(task.assignee_id) ?? null
            : null;
          return (
            <button
              key={task.id}
              type="button"
              onClick={() => onEdit(task)}
              className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-start shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-medium text-slate-900">
                  {task.title}
                </p>
                <PriorityDot priority={task.priority} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <TaskDueDisplay
                  due_start={task.due_start}
                  due_end={task.due_end}
                  due_label={task.due_label}
                  withIcon={false}
                />
                {assignee && (
                  <Avatar
                    name={assignee.name}
                    avatarUrl={assignee.avatar_url}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt=""
        title={name}
        className="h-6 w-6 rounded-full"
      />
    );
  }
  return (
    <span
      title={name}
      className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-semibold text-brand-700"
    >
      {initial}
    </span>
  );
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  low: "bg-slate-300",
  med: "bg-amber-400",
  high: "bg-red-500",
};

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return (
    <span
      className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[priority])}
      title={PRIORITY_LABELS_HE[priority]}
      aria-label={PRIORITY_LABELS_HE[priority]}
    />
  );
}

function compareTasks(a: Task, b: Task): number {
  const order: Record<TaskPriority, number> = { high: 0, med: 1, low: 2 };
  const p = order[a.priority] - order[b.priority];
  if (p !== 0) return p;
  const aKey = a.due_start ?? a.due_end ?? null;
  const bKey = b.due_start ?? b.due_end ?? null;
  if (aKey === null && bKey === null) return 0;
  if (aKey === null) return 1;
  if (bKey === null) return -1;
  return aKey.localeCompare(bKey);
}
