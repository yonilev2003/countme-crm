// Specialized chat loading: sidebar list + empty main pane.

export default function ChatLoading() {
  return (
    <div className="-m-6 flex h-[calc(100vh-4rem)] min-h-0 flex-1 animate-pulse overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-e border-slate-200 bg-white md:flex md:flex-col">
        <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
          <div className="h-5 w-20 rounded bg-slate-200" />
          <div className="h-6 w-16 rounded-lg bg-slate-200" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded-lg bg-slate-100" />
          ))}
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center bg-slate-50">
        <div className="h-3 w-32 rounded bg-slate-200" />
      </main>
    </div>
  );
}
