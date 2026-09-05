import { useEffect, useRef } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

interface PaginationProps {
  label: string
  page: number
  pageSize: number
  totalCount: number
  requestedPage: number
  isFetching: boolean
  onNextPage: () => void
  onPreviousPage: () => void
}

export function Pagination({
  label,
  page,
  pageSize,
  totalCount,
  requestedPage,
  isFetching,
  onNextPage,
  onPreviousPage,
}: PaginationProps) {
  const totalPages = Math.ceil(totalCount / pageSize)
  // Keep unavailable controls focusable through loading and page boundaries; guard their actions below.
  const previousUnavailable = isFetching || page === 1
  const nextUnavailable = isFetching || page >= totalPages
  const pagination = useRef<HTMLElement>(null)

  useEffect(() => {
    const focused = document.activeElement
    if (
      focused instanceof HTMLElement &&
      pagination.current?.contains(focused)
    ) {
      focused.scrollIntoView({ block: 'nearest' })
    }
  }, [page])

  if (totalPages <= 1) return null

  return (
    <nav
      ref={pagination}
      aria-label={label}
      className="grid grid-cols-2 items-center gap-3 border-t border-line px-5 py-4 sm:flex sm:justify-between sm:gap-4 sm:px-6"
    >
      <button
        className="row-start-2 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 aria-disabled:cursor-not-allowed aria-disabled:text-muted sm:w-auto"
        type="button"
        aria-disabled={previousUnavailable}
        onClick={() => {
          if (!previousUnavailable) onPreviousPage()
        }}
      >
        <FiChevronLeft aria-hidden="true" className="size-4" />
        Previous
      </button>
      <p
        aria-live="polite"
        aria-atomic="true"
        className="col-span-2 row-start-1 text-center text-sm whitespace-nowrap text-muted sm:col-auto sm:row-auto"
      >
        {isFetching
          ? `Loading page ${String(requestedPage)}…`
          : `Page ${String(page)} of ${String(totalPages)}`}
      </p>
      <button
        className="row-start-2 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-line bg-surface px-3.5 text-sm font-semibold text-ink transition-colors duration-200 hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 aria-disabled:cursor-not-allowed aria-disabled:text-muted sm:w-auto"
        type="button"
        aria-disabled={nextUnavailable}
        onClick={() => {
          if (!nextUnavailable) onNextPage()
        }}
      >
        Next
        <FiChevronRight aria-hidden="true" className="size-4" />
      </button>
    </nav>
  )
}
