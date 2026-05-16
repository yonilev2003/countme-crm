import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DatasetUploader } from "@/components/datasets/dataset-uploader";

export default function NewDatasetPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <nav className="flex items-center gap-1 text-sm text-slate-500">
        <Link href="/datasets" className="hover:text-slate-700">
          דאטה
        </Link>
        <ChevronRight className="h-4 w-4 -scale-x-100" aria-hidden />
        <span className="text-slate-700">דאטהסט חדש</span>
      </nav>

      <header>
        <h1 className="font-display text-3xl font-bold text-slate-900">
          דאטהסט חדש
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          העלאת קובץ XLSX או CSV. נזהה את העמודות אוטומטית — אפשר לשנות סוגים
          לפני השמירה.
        </p>
      </header>

      <DatasetUploader />
    </div>
  );
}
