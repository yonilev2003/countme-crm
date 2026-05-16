export default function GanttPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">גאנט</h1>
          <p className="mt-2 text-slate-600">
            פרויקטים עם ציר זמן, סנכרון אוטומטי ממשימות
          </p>
        </div>
        <button
          disabled
          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-400"
        >
          ייבא XLSX (Phase D)
        </button>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Phase D
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">בקרוב</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          גאנט HTML/CSS מותאם RTL עם drag-to-resize. ייבוא XLSX יוצר פרויקט
          ומשימות; כל תאריך לא ברור נשאל מהמשתמש לפני שמירה.
        </p>
      </div>
    </div>
  );
}
