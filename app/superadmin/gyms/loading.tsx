export default function GymsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-36 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-4 w-28 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-md bg-zinc-200" />
      </div>

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white px-4 py-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="h-4 animate-pulse rounded bg-zinc-200" style={{ width: `${40 + (i % 4) * 12}%` }} />
              <div className="h-5 w-10 animate-pulse rounded-full bg-zinc-100" />
            </div>
            <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block rounded-lg border bg-white overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 border-b px-4 py-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3.5 w-20 animate-pulse rounded bg-zinc-200" />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 border-b last:border-0 px-4 py-3.5 items-center">
            <div className="h-4 animate-pulse rounded bg-zinc-200" style={{ width: `${45 + (i % 4) * 10}%` }} />
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-100" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100" />
            <div className="h-5 w-8 animate-pulse rounded-full bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  )
}
