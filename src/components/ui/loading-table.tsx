// Reusable Suspense fallback that mimics a list/table page.
// Header is NOT included here — pages render their own header above the Suspense
// boundary so it appears instantly. This skeleton only stands in for the data.

type Props = {
  rows?: number;
  showToolbar?: boolean;
};

export function LoadingTable({ rows = 8, showToolbar = false }: Props) {
  return (
    <div className="animate-pulse space-y-3">
      {showToolbar && (
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-slate-100" />
          <div className="h-8 w-20 rounded-full bg-slate-100" />
          <div className="h-8 w-24 rounded-full bg-slate-100" />
        </div>
      )}
      <div className="h-12 w-full rounded-lg bg-slate-100" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 w-full rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
