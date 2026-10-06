export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-lg border border-line bg-white p-4 shadow-sm">
          <div className="h-4 w-1/3 rounded bg-zinc-200" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="h-3 rounded bg-zinc-100" />
            <div className="h-3 rounded bg-zinc-100" />
            <div className="h-3 rounded bg-zinc-100" />
            <div className="h-3 rounded bg-zinc-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
