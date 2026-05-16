import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PeopleTable } from "@/components/people/people-table";
import type { OwnerProfile, Person } from "@/lib/people";

export default async function PeoplePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [peopleRes, profilesRes] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, name, email, phone, company, role, status, tags, notes, owner_id, created_at, updated_at",
      )
      .order("updated_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, display_name, full_name, avatar_url"),
  ]);

  const people = (peopleRes.data ?? []) as Person[];
  const profiles = (profilesRes.data ?? []) as OwnerProfile[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">אנשי קשר</h1>
          <p className="mt-2 text-slate-600">מאגר אנשי הקשר של הצוות</p>
        </div>
        <Link
          href="/people/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          איש קשר חדש
        </Link>
      </div>

      <PeopleTable
        people={people}
        currentUserId={user?.id ?? ""}
        profiles={profiles}
      />
    </div>
  );
}
