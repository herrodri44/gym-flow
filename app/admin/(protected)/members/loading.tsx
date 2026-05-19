export default function MembersLoading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-24 animate-pulse rounded-md bg-zinc-200" />
          <div className="h-4 w-16 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-200" />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-10 animate-pulse rounded bg-zinc-200 mr-1" />
          {[56, 68, 44].map((w, i) => (
            <div key={i} className="h-7 animate-pulse rounded-full bg-zinc-100" style={{ width: w }} />
          ))}
        </div>
        <div className="w-px self-stretch bg-zinc-200" />
        <div className="flex items-center gap-1.5">
          <div className="h-3.5 w-10 animate-pulse rounded bg-zinc-200 mr-1" />
          {[96, 64, 76, 72].map((w, i) => (
            <div key={i} className="h-7 animate-pulse rounded-full bg-zinc-100" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Split panel */}
      <div className="flex h-[70vh] min-h-96 gap-4">
        {/* Left list */}
        <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-3">
            <div className="h-8 animate-pulse rounded-md bg-zinc-100" />
          </div>
          <div className="flex-1 divide-y overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                <div className="size-2 shrink-0 animate-pulse rounded-full bg-zinc-200" />
                <div className="flex-1 space-y-1">
                  <div
                    className="h-3.5 animate-pulse rounded bg-zinc-200"
                    style={{ width: `${55 + (i % 5) * 9}%` }}
                  />
                  <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right detail */}
        <div className="flex flex-1 items-center justify-center rounded-xl border bg-white">
          <div className="flex flex-col items-center gap-2">
            <div className="text-3xl text-zinc-200">←</div>
            <div className="h-4 w-48 animate-pulse rounded bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>
  )
}
