// Tasks loading: matches the table view shape.

export default function TasksLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-8 w-32 rounded bg-slate-200" />
        <div className="h-4 w-64 rounded bg-slate-100" />
      </div>
      <div className="h-14 w-full rounded-xl bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-full bg-slate-100" />
        <div className="h-8 w-20 rounded-full bg-slate-100" />
        <div className="h-8 w-24 rounded-full bg-slate-100" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
