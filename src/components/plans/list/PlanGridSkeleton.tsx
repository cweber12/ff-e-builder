export function PlanGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
        >
          <div className="aspect-[4/3] animate-pulse bg-neutral-100" />
          <div className="space-y-3 px-4 pb-4 pt-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-12 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-16 animate-pulse rounded bg-neutral-100" />
            </div>
            <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-100" />
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-neutral-100" />
            </div>
            <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
