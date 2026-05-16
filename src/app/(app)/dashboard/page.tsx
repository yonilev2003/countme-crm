import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">לוח בקרה</h1>
        <p className="mt-2 text-slate-600">סקירה כללית של הצוות</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="אנשים" value="—" hint="עתיד להתמלא" />
        <StatCard label="משימות פתוחות" value="—" hint="עתיד להתמלא" />
        <StatCard label="אירועים השבוע" value="—" hint="עתיד להתמלא" />
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <p className="font-medium text-slate-900">סטטוס Phase A</p>
        <p className="mt-2">
          התשתית עלתה. השלבים הבאים: אנשים → משימות → גאנט → מסמכים → צ׳אט → יומן.
        </p>
        {user && (
          <p className="mt-3 font-mono text-xs text-slate-400">
            user_id: {user.id}
          </p>
        )}
      </div>
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
