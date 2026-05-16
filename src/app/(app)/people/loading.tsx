export default function PeopleLoading() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded bg-slate-200" />
          <div className="h-4 w-72 rounded bg-slate-100" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-brand-200" />
      </div>
      <div className="h-12 w-full rounded-lg bg-slate-100" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
