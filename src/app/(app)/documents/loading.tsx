export default function DocumentsLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="space-y-2">
        <div className="h-8 w-32 rounded bg-slate-200" />
        <div className="h-4 w-64 rounded bg-slate-100" />
      </div>
      <div className="h-32 w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-48 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
