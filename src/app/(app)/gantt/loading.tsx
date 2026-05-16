export default function GanttLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-24 rounded bg-slate-200" />
          <div className="h-4 w-64 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-lg bg-slate-100" />
          <div className="h-10 w-32 rounded-lg bg-brand-200" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
