import Link from "next/link";
import { Users, CheckSquare, MessageSquare, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let firstName = "להנהלת CountMe";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const source = profile?.display_name || profile?.full_name;
    if (source && source.trim().length > 0) {
      firstName = source.trim().split(/\s+/)[0];
    }
  }

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [peopleRes, tasksRes, eventsRes] = await Promise.all([
    supabase.from("people").select("id", { count: "exact", head: true }),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "done"),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("start_at", now.toISOString())
      .lt("start_at", weekAhead.toISOString()),
  ]);

  const peopleCount = peopleRes.count ?? 0;
  const tasksCount = tasksRes.count ?? 0;
  const eventsCount = eventsRes.count ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          ברוכים הבאים, {firstName}
        </h1>
        <p className="mt-2 text-slate-600">סקירה כללית של הצוות</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="אנשים" value={String(peopleCount)} hint="סך הכל ברשת" />
        <StatCard
          label="משימות פתוחות"
          value={String(tasksCount)}
          hint="לא הושלמו"
        />
        <StatCard
          label="אירועים השבוע"
          value={String(eventsCount)}
          hint="ב-7 הימים הקרובים"
        />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 font-display text-xl font-bold text-slate-900">
          פעולות מהירות
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionTile
            href="/people"
            icon={Users}
            title="אנשים"
            description="ניהול אנשי קשר ושותפים"
          />
          <QuickActionTile
            href="/tasks"
            icon={CheckSquare}
            title="משימות"
            description="מעקב אחר משימות הצוות"
          />
          <QuickActionTile
            href="/chat"
            icon={MessageSquare}
            title="צ׳אט"
            description="שיחות פנימיות"
          />
          <QuickActionTile
            href="/calendar"
            icon={Calendar}
            title="יומן"
            description="אירועים ופגישות"
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="text-sm text-slate-600">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function QuickActionTile({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
    >
      <Icon className="h-6 w-6 text-brand-500" />
      <div className="mt-3 font-display text-base font-bold text-slate-900">
        {title}
      </div>
      {description && (
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      )}
    </Link>
  );
}
