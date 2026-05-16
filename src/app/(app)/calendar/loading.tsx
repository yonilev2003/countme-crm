// Specialized skeleton for the calendar page — month grid placeholder
// to avoid the jarring blank-on-navigation.

export default function CalendarLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 rounded bg-slate-200" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-slate-100" />
          <div className="h-9 w-28 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-7 w-16 rounded-full bg-slate-100" />
        <div className="h-7 w-16 rounded-full bg-slate-100" />
        <div className="h-7 w-20 rounded-full bg-slate-100" />
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="h-24 bg-white" />
        ))}
      </div>
    </div>
  );
}
