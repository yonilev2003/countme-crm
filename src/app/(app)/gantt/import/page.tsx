import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ImportWizard } from "@/components/gantt/import-wizard";

export default function GanttImportPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link href="/gantt" className="hover:text-slate-700">
          גאנט
        </Link>
        <ChevronRight className="h-4 w-4 -scale-x-100" aria-hidden />
        <span className="text-slate-700">ייבוא מאקסל</span>
      </nav>

      <header>
        <h1 className="font-display text-3xl font-bold text-slate-900">
          ייבוא פרויקט מקובץ XLSX
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          העלאת קובץ עם משימות ותאריכים. ביטויי תאריך לא חד-משמעיים יוצגו
          להבהרה לפני שמירה.
        </p>
      </header>

      <ImportWizard />
    </div>
  );
}
