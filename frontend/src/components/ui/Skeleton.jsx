export default function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="p-4" role="status" aria-label="Loading data">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            {Array.from({ length: cols - 1 }).map((__, colIndex) => (
              <Skeleton
                key={colIndex}
                className="h-4"
                style={{ width: `${100 / cols + (colIndex % 3) * 4}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardSkeletonBlock({ lines }) {
  return (
    <div
      className="rounded-xl border border-line bg-surface p-5 shadow-card"
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="mb-3 h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className={`mb-2 h-3.5 ${index % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 3, count }) {
  if (!count) return <CardSkeletonBlock lines={lines} />;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeletonBlock key={index} lines={lines} />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div
      className="rounded-xl border border-line bg-surface p-5 shadow-card"
      role="status"
      aria-label="Loading statistic"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}
