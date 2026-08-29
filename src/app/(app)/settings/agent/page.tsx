import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgentTokensPanel } from "./agent-tokens-panel";

export default async function AgentSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: tokens } = await supabase
    .from("agent_tokens")
    .select("id, name, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://countme-crm.vercel.app";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">מפתח AI אישי</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          טוקן אישי שמחבר את Claude, ChatGPT או כל סוכן AI אחר אל CountMe —
          בלי לתת להם גישה ישירה למסד הנתונים. הסוכן יכול רק לקרוא ולעדכן
          דרך פעולות מוגדרות מראש, בהיקף ההרשאות שלך (המשימות שלך, ואם אתה
          אדמין — גם תמונת מצב של הצוות).
        </p>
      </div>

      <AgentTokensPanel tokens={tokens ?? []} appUrl={appUrl} />

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-800">איך זה עובד</p>
        <p className="mt-1">
          תיצור טוקן, תעתיק אותו למקום בטוח (מוצג פעם אחת בלבד), ותוסיף אותו
          לכלי ה-AI שלך ככותרת <code>Authorization: Bearer &lt;טוקן&gt;</code>{" "}
          מול הכתובות תחת <code>/api/agent/*</code>. פירוט מלא של כל
          הפעולות הזמינות נמצא ב-<code>docs/agent-api.md</code> במאגר הקוד.
        </p>
      </div>
    </div>
  );
}
