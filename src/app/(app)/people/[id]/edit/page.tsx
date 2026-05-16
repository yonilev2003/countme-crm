import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PeopleForm } from "@/components/people/people-form";
import type { Person, PersonInput } from "@/lib/people";
import { updatePerson } from "../../actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPersonPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: personRow } = await supabase
    .from("people")
    .select(
      "id, name, email, phone, company, role, status, tags, notes, owner_id, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!personRow) notFound();

  const person = personRow as Person;

  // Owners only — non-owners can't edit. Send them back to the view page.
  if (person.owner_id !== user.id) {
    redirect(`/people/${person.id}`);
  }

  async function action(input: PersonInput) {
    "use server";
    return updatePerson(id, input);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/people" className="hover:text-slate-900">
          אנשי קשר
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180 text-slate-400" />
        <Link href={`/people/${person.id}`} className="hover:text-slate-900">
          {person.name}
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180 text-slate-400" />
        <span className="text-slate-900">עריכה</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">עריכת איש קשר</h1>
        <p className="mt-1 text-sm text-slate-600">
          עדכן/י את הפרטים של {person.name}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <PeopleForm
          initialValues={person}
          action={action}
          submitLabel="שמור שינויים"
          cancelHref={`/people/${person.id}`}
        />
      </div>
    </div>
  );
}
