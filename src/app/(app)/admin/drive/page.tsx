import { createClient } from "@/lib/supabase/server";
import { ConnectDriveCard } from "@/components/admin/connect-drive-card";

export default async function AdminDrivePage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const supabase = await createClient();
  const { data: cfg } = await supabase
    .from("team_config")
    .select(
      "shared_drive_refresh_token, shared_drive_token_expires_at, shared_drive_folder_id, shared_drive_folder_name, shared_drive_last_sync, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  const params = await searchParams;
  const justConnected = params.connected === "1";
  const errorParam = params.error;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Drive צוות</h1>
        <p className="mt-2 text-slate-600">
          חיבור Google Drive המשותף (countme5555@gmail.com) לסנכרון אוטומטי של מסמכי הצוות
        </p>
      </div>

      {justConnected && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Drive הצוות חובר בהצלחה. הסנכרון יחל אוטומטית עם פתיחת עמוד המסמכים.
        </div>
      )}
      {errorParam && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          שגיאה: {errorParam}
        </div>
      )}

      <ConnectDriveCard config={cfg ?? null} />
    </div>
  );
}
