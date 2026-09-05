import { FiAlertCircle } from 'react-icons/fi'
import { Link } from 'react-router'

export function OrganisationUnavailable() {
  return (
    <div className="rounded-panel border border-line bg-surface p-6 shadow-panel sm:p-8">
      <FiAlertCircle aria-hidden="true" className="size-6 text-muted" />
      <h2 className="mt-4 text-lg font-semibold text-ink">
        Organisation unavailable
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        This organisation may no longer exist, or your account may no longer
        have access to it.
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control bg-brand-700 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        to="/organisations"
      >
        Return to organisations
      </Link>
    </div>
  )
}
