export function ListLoading({ label }: { label: string }) {
  return (
    <div
      className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel"
      role="status"
    >
      <span className="sr-only">{label}</span>
      <div
        className="border-b border-line px-5 py-5 sm:px-6"
        aria-hidden="true"
      >
        <div className="h-4 w-36 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
      </div>
      <div
        className="flex items-center gap-4 px-5 py-5 sm:px-6"
        aria-hidden="true"
      >
        <div className="size-11 animate-pulse rounded-control bg-slate-200 motion-reduce:animate-none" />
        <div className="flex-1">
          <div className="h-4 max-w-56 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
          <div className="mt-2 h-3 max-w-24 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  )
}
