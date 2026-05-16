"use client";

import { useState } from "react";
import { List, LayoutGrid } from "lucide-react";
import { TaskTable } from "@/components/tasks/task-table";
import { TaskKanban } from "@/components/tasks/task-kanban";
import type {
  PersonOption,
  ProfileOption,
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
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
