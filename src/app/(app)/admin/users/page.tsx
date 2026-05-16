import { createClient } from "@/lib/supabase/server";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, display_name, email, avatar_url, role, is_admin, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">ניהול משתמשים</h1>
        <p className="mt-2 text-slate-600">
          צפייה ועריכת תפקידים והרשאות של חברי הנהלת CountMe
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        מסך זה ייפתח לעריכת תפקידים והרשאות בשלב B2 הבא. כרגע ניתן לראות את
        המשתמשים בטבלת <code className="font-mono">profiles</code> ב־Supabase.
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-start font-medium"></th>
              <th className="px-4 py-3 text-start font-medium">שם</th>
              <th className="px-4 py-3 text-start font-medium">אימייל</th>
              <th className="px-4 py-3 text-start font-medium">תפקיד</th>
              <th className="px-4 py-3 text-start font-medium">אדמין</th>
              <th className="px-4 py-3 text-start font-medium">נוצר</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map((p) => {
              const name = p.display_name ?? p.full_name ?? "—";
              const created = p.created_at
                ? new Date(p.created_at).toLocaleDateString("he-IL")
                : "—";
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.avatar_url}
                        alt={name}
                        className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-900">{name}</td>
                  <td className="px-4 py-3 text-slate-700">{p.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.role ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.is_admin ? "כן" : "לא"}</td>
                  <td className="px-4 py-3 text-slate-500">{created}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
