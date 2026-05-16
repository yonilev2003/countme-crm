"use client";

import { useState } from "react";
import { List, LayoutGrid, Plus } from "lucide-react";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskKanban } from "@/components/tasks/task-kanban";
import {
  TaskFormDialog,
  type PersonOption,
  type ProfileOption,
} from "@/components/tasks/task-form-dialog";
import type { Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

type View = "table" | "kanban";

type Props = {
  tasks: Task[];
  profiles: ProfileOption[];
  people: PersonOption[];
  currentUserId: string;
};

export function TaskViews({ tasks, profiles, people, currentUserId }: Props) {
  const [view, setView] = useState<View>("table");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          משימה חדשה
        </button>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <ToggleButton
            active={view === "table"}
            onClick={() => setView("table")}
            label="טבלה"
            icon={<List className="h-4 w-4" />}
          />
          <ToggleButton
            active={view === "kanban"}
            onClick={() => setView("kanban")}
            label="קנבן"
            icon={<LayoutGrid className="h-4 w-4" />}
          />
        </div>
      </div>

      {view === "table" ? (
        <TaskTable
          tasks={tasks}
          profiles={profiles}
          people={people}
          currentUserId={currentUserId}
        />
      ) : (
        <TaskKanban
          tasks={tasks}
          profiles={profiles}
          people={people}
          currentUserId={currentUserId}
        />
      )}

      <TaskFormDialog
        open={createOpen}
        mode={{ kind: "create" }}
        profiles={profiles}
        people={people}
        onClose={() => setCreateOpen(false)}
      />

      {/* Mobile FAB — always visible on small screens for quick task creation */}
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-6 end-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg ring-1 ring-brand-700/20 transition hover:bg-brand-600 active:scale-95 md:hidden"
        aria-label="משימה חדשה"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-brand-500 text-white"
          : "text-slate-700 hover:bg-slate-50",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
