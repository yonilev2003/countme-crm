import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { TaskViews } from "@/components/tasks/task-views";
import type {
  PersonOption,
  ProfileOption,
} from "@/components/tasks/task-form-dialog";
import type { Task } from "@/lib/tasks";

type ProfileRow = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type PersonRow = {
  id: string;
  name: string;
  company: string | null;
};

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch in parallel — RLS lets any authenticated user read tasks/people/profiles.
  const [tasksRes, profilesRes, peopleRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, title, description, due_start, due_end, due_label, status, priority, assignee_id, person_id, project_id, owner_id, google_event_id, created_at, updated_at",
      )
      .order("due_start", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, full_name, email, avatar_url"),
    supabase
      .from("people")
      .select("id, name, company")
      .order("name", { ascending: true }),
  ]);

  const tasks = (tasksRes.data ?? []) as Task[];

  const profiles: ProfileOption[] = (
    (profilesRes.data ?? []) as ProfileRow[]
  ).map((p) => ({
    id: p.id,
    name: p.display_name ?? p.full_name ?? p.email ?? "ללא שם",
    avatar_url: p.avatar_url,
  }));

  const people: PersonOption[] = (
    (peopleRes.data ?? []) as PersonRow[]
  ).map((p) => ({
    id: p.id,
    name: p.name,
    company: p.company,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900">משימות</h1>
        <p className="text-sm text-slate-600">
          ניהול משימות עם תאריכים גמישים. הקלידו בעברית טבעית — &quot;מחר&quot;, &quot;סוף החודש&quot;, &quot;Q2 2026&quot; — וה־AI יבין.
        </p>
      </header>

      <TaskQuickAdd />

      <TaskViews
        tasks={tasks}
        profiles={profiles}
        people={people}
        currentUserId={user.id}
      />
    </div>
  );
}
