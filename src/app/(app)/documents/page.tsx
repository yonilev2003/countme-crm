export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">מסמכים</h1>
        <p className="mt-2 text-slate-600">
          העלאת קבצים מקושרים לאנשים ופרויקטים
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Phase E
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">בקרוב</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          Supabase Storage עם RLS לפי בעלים. תצוגת רשת, מיניאטורות לתמונות,
          הורדה ומחיקה (לבעלים בלבד).
        </p>
      </div>
    </div>
  );
}
