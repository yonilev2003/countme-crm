import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { Topbar } from "@/components/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, avatar_url, google_refresh_token")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.full_name ?? user.user_metadata?.full_name ?? null;
  const email = profile?.email ?? user.email ?? null;
  const avatarUrl =
    profile?.avatar_url ?? user.user_metadata?.avatar_url ?? null;
  const calendarConnected = Boolean(profile?.google_refresh_token);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={name} email={email} avatarUrl={avatarUrl} />
        {!calendarConnected && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
            יומן Google לא מחובר עדיין. התנתק והתחבר שוב כדי להפעיל סנכרון.
          </div>
        )}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
