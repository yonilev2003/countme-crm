// Universal loading skeleton shown instantly while server components stream in.
// This gives users immediate visual feedback on every navigation.

export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
      </div>

      <div className="space-y-3">
        <div className="h-10 w-full rounded-lg bg-slate-100" />
        <div className="h-10 w-full rounded-lg bg-slate-100" />
        <div className="h-10 w-full rounded-lg bg-slate-100" />
        <div className="h-10 w-full rounded-lg bg-slate-100" />
        <div className="h-10 w-full rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}
