import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarShell } from "./calendar-shell";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, google_refresh_token")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = Boolean(profile?.is_admin);
  const personalConnected = Boolean(profile?.google_refresh_token);

  const { data: teamCfg } = await supabase
    .from("team_config")
    .select("shared_calendar_email, shared_calendar_refresh_token")
    .eq("id", 1)
    .maybeSingle();
  const teamConnected = Boolean(teamCfg?.shared_calendar_refresh_token);

  // Pull a generous window so the user can navigate ±1 month without re-fetch.
  const now = new Date();
  const winStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const winEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  const [eventsRes, tasksRes, profilesRes, peopleRes, projectsRes, attendeesRes] =
    await Promise.all([
      supabase
        .from("events")
        .select(
          "id, title, description, start_at, end_at, kind, person_id, project_id, owner_id",
        )
        .gte("start_at", winStart)
        .lte("start_at", winEnd)
        .order("start_at", { ascending: true }),
      supabase
        .from("tasks")
        .select("id, title, due_start, due_end")
        .not("due_start", "is", null)
        .gte("due_start", winStart.slice(0, 10))
        .lte("due_start", winEnd.slice(0, 10)),
      supabase
        .from("profiles")
        .select("id, display_name, full_name, email")
        .order("display_name", { ascending: true }),
      supabase.from("people").select("id, name").order("name"),
      supabase.from("projects").select("id, name").order("name"),
      supabase.from("event_attendees").select("event_id, profile_id"),
    ]);

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
  };

  type TaskRow = {
    id: string;
    title: string;
    due_start: string | null;
    due_end: string | null;
  };

  const events = (eventsRes.data ?? []) as EventRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const profiles = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name ?? p.full_name ?? p.email ?? "—",
    email: p.email ?? null,
  }));
  const people = (peopleRes.data ?? []) as { id: string; name: string }[];
  const projects = (projectsRes.data ?? []) as { id: string; name: string }[];
  const attendees = (attendeesRes.data ?? []) as {
    event_id: string;
    profile_id: string;
  }[];

  // Build attendees map { event_id → profile_ids[] }
  const attendeesByEvent = new Map<string, string[]>();
  for (const a of attendees) {
    const arr = attendeesByEvent.get(a.event_id) ?? [];
    arr.push(a.profile_id);
    attendeesByEvent.set(a.event_id, arr);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">יומן</h1>
          <p className="mt-1 text-sm text-slate-600">
            תצוגה חודשית עם סנכרון דו-כיווני ל-Google Calendar
          </p>
        </div>
      </div>

      {!personalConnected && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          יומן Google האישי לא מחובר. התנתק והתחבר שוב כדי להפעיל סנכרון אישי.
        </div>
      )}

      {!teamConnected && isAdmin && (
        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          יומן הצוות לא מחובר עדיין —{" "}
          <Link
            href="/admin/calendar"
            className="font-semibold text-amber-900 underline underline-offset-2 hover:opacity-80"
          >
            לחץ כדי לחבר
          </Link>
          .
        </div>
      )}

      <CalendarShell
        currentUserId={user.id}
        isAdmin={isAdmin}
        events={events.map((e) => ({
          ...e,
          attendee_profile_ids: attendeesByEvent.get(e.id) ?? [],
        }))}
        tasks={tasks}
        profiles={profiles}
        people={people}
        projects={projects}
      />
    </div>
  );
}
