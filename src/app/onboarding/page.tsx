import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, display_name, role, onboarded_at, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarded_at) {
    redirect("/dashboard");
  }

  const initialName = profile?.display_name || profile?.full_name || "";
  const initialRole = profile?.role || "";
  const email = profile?.email ?? user.email ?? "";
  const avatarUrl = profile?.avatar_url ?? null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-2xl font-bold text-slate-900">
            ברוכים הבאים להנהלת CountMe
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            כמה פרטים אחרונים לפני שנתחיל
          </p>
        </div>

        <OnboardingForm
          initialName={initialName}
          initialRole={initialRole}
          email={email}
          avatarUrl={avatarUrl}
        />
      </div>
    </main>
  );
}
