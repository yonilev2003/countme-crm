import { createClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("google_refresh_token, google_token_expires_at")
    .eq("id", user!.id)
    .maybeSingle();

  const connected = Boolean(profile?.google_refresh_token);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">יומן</h1>
        <p className="mt-2 text-slate-600">
          תצוגה חודשית עם סנכרון דו-כיווני ל-Google Calendar
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">
              מצב חיבור Google Calendar
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {connected
                ? "מחובר. refresh_token נשמר בהצלחה."
                : "לא מחובר. התנתק והתחבר שוב עם הרשאת Calendar."}
            </div>
          </div>
          <div
            className={
              connected
                ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                : "rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
            }
          >
            {connected ? "מחובר" : "לא מחובר"}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Phase G
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">בקרוב</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          תצוגה חודשית (שבוע מתחיל ביום ראשון), סנכרון Google Calendar עם
          sync_token, יצירת אירועים עם Meet ו-הזמנת חברי צוות.
        </p>
      </div>
    </div>
  );
}
