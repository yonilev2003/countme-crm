import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOAuthClient } from "@/lib/oauth/store";
import { approveAuthorization, denyAuthorization } from "./actions";

function ErrorScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50/40 to-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-red-700">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{message}</p>
      </div>
    </main>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const responseType = get("response_type");
  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeChallenge = get("code_challenge");
  const codeChallengeMethod = get("code_challenge_method");
  const state = get("state") ?? "";

  if (responseType !== "code" || !clientId || !redirectUri || !codeChallenge) {
    return (
      <ErrorScreen
        title="בקשה לא תקינה"
        message="חסרים פרמטרים נדרשים ל-OAuth (response_type, client_id, redirect_uri, code_challenge)."
      />
    );
  }
  if (codeChallengeMethod !== "S256") {
    return (
      <ErrorScreen
        title="שיטת PKCE לא נתמכת"
        message="נדרש code_challenge_method=S256."
      />
    );
  }

  const client = await getOAuthClient(clientId);
  if (!client) {
    return <ErrorScreen title="לקוח לא מוכר" message="ה-client_id הזה לא רשום." />;
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return (
      <ErrorScreen
        title="כתובת חזרה לא תואמת"
        message="ה-redirect_uri לא תואם למה שנרשם עבור הלקוח הזה."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const query = new URLSearchParams({
      response_type: responseType,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      ...(state ? { state } : {}),
    });
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.display_name || profile?.full_name || profile?.email || "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50/40 to-slate-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <img src="/countme-logo.svg" alt="" className="mx-auto h-12 w-12 mb-3" />
          <h1 className="text-xl font-bold text-slate-900">
            {client.client_name} מבקש גישה ל-CountMe
          </h1>
          <p className="mt-2 text-sm text-slate-600">מחובר כ-{displayName}</p>
        </div>

        <ul className="mb-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <li>• קריאה של המשימות שלך, ותמונת מצב של הצוות</li>
          <li>• יצירה ועדכון של משימות בשמך</li>
          <li>• בהתאם להרשאות שלך במערכת (אדמין / חבר צוות)</li>
        </ul>

        <div className="flex gap-3">
          <form action={approveAuthorization} className="flex-1">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            <input type="hidden" name="state" value={state} />
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              אשר גישה
            </button>
          </form>
          <form action={denyAuthorization} className="flex-1">
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
            <button
              type="submit"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              ביטול
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
