import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PeopleForm } from "@/components/people/people-form";
import { createPerson } from "../actions";

export default function NewPersonPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <nav className="mb-4 flex items-center gap-1 text-sm text-slate-500">
        <Link href="/people" className="hover:text-slate-900">
          אנשי קשר
        </Link>
        <ChevronRight className="h-4 w-4 rotate-180 text-slate-400" />
        <span className="text-slate-900">חדש</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">איש קשר חדש</h1>
        <p className="mt-1 text-sm text-slate-600">
          הוסף/י איש קשר חדש למאגר הצוות
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <PeopleForm
          initialValues={null}
          action={createPerson}
          submitLabel="צור איש קשר"
          cancelHref="/people"
        />
      </div>
    </div>
  );
}
