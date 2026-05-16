export default function TasksPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">משימות</h1>
        <p className="mt-2 text-slate-600">
          ניהול משימות עם תאריכי יעד, עדיפויות וקישור לאנשים/פרויקטים
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
        <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Phase C
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">בקרוב</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
          רשימה + Kanban, quick-add עם פענוח תאריכים בעברית (Claude Haiku):
          &quot;מחר 14:00&quot; / &quot;סוף החודש&quot; / &quot;ביום ראשון&quot;.
        </p>
      </div>
    </div>
  );
}
