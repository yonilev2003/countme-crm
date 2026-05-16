import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersTable, type UserRow } from "./users-table";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Defensive: even though the admin layout guards this route, re-check here.
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!callerProfile?.is_admin) redirect("/dashboard");

  const { data: profilesData } = await supabase
    .from("profiles")
    .select(
      "id, display_name, full_name, email, avatar_url, role, is_admin, created_at",
    )
    .order("created_at", { ascending: true });

  const users = (profilesData ?? []) as UserRow[];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">ניהול משתמשים</h1>
        <p className="mt-2 text-slate-600">
          עריכת תפקיד והרשאות אדמין לחברי הצוות. שינויים נשמרים מיד.
        </p>
      </div>

      <UsersTable users={users} currentUserId={user.id} />
    </div>
  );
}
