import { createClient } from "@/lib/supabase/server";
import { ConnectTeamCalCard } from "@/components/calendar/connect-team-cal-card";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("team_config")
    .select(
      "shared_calendar_email, shared_calendar_refresh_token, shared_calendar_token_expires_at, shared_calendar_sync_token, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  const params = await searchParams;
  const justConnected = params.connected === "1";
  const errorParam = params.error;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">יומן צוות</h1>
        <p className="mt-2 text-slate-600">
          חיבור היומן המשותף (countme5555@gmail.com) לסנכרון אירועי צוות
        </p>
      </div>

      {justConnected && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          יומן הצוות חובר בהצלחה. סנכרון ראשון יבוצע ברגע שתלחץ "סנכרן עכשיו".
        </div>
      )}
      {errorParam && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          שגיאה: {errorParam}
        </div>
      )}

      <ConnectTeamCalCard config={cfg ?? null} />
    </div>
  );
}
