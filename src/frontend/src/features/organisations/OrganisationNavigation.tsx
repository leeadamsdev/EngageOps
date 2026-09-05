import { FiBriefcase, FiGrid, FiRepeat, FiUser, FiUsers } from 'react-icons/fi'
import { Link, NavLink } from 'react-router'
import { useOrganisations } from './useOrganisations'

interface OrganisationNavigationProps {
  userId: string
  organisationId: string | undefined
}

export function OrganisationNavigation({
  userId,
  organisationId,
}: OrganisationNavigationProps) {
  return organisationId ? (
    <WorkspaceNavigation userId={userId} organisationId={organisationId} />
  ) : (
    <nav aria-label="Primary" className="px-5 py-3 sm:px-8 lg:p-5">
      <NavLink className={navigationClassName} end to="/organisations">
        <FiBriefcase aria-hidden="true" className="size-4 shrink-0" />
        Organisations
      </NavLink>
    </nav>
  )
}

function WorkspaceNavigation({
  userId,
  organisationId,
}: {
  userId: string
  organisationId: string
}) {
  const organisations = useOrganisations(userId)
  const organisation = organisations.isSuccess
    ? organisations.data.find(
        (item) => item.id.toLowerCase() === organisationId.toLowerCase(),
      )
    : undefined
  const path = `/organisations/${encodeURIComponent(organisationId)}`

  return (
    <div className="px-5 py-3 sm:px-8 lg:p-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line pb-3 lg:block lg:pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Current organisation</p>
          <p className="mt-1 text-sm font-semibold wrap-anywhere text-ink">
            {organisation?.name ?? 'Organisation'}
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 rounded-control text-xs font-semibold text-brand-700 hover:text-brand-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          to="/organisations"
        >
          <FiRepeat aria-hidden="true" className="size-4 shrink-0" />
          Switch organisation
        </Link>
      </div>
      <nav
        aria-label="Primary"
        className="mt-3 flex flex-wrap gap-1 lg:flex-col"
      >
        <NavLink className={navigationClassName} end to={path}>
          <FiGrid aria-hidden="true" className="size-4 shrink-0" />
          Overview
        </NavLink>
        <NavLink className={navigationClassName} to={`${path}/clients`}>
          <FiUsers aria-hidden="true" className="size-4 shrink-0" />
          Clients
        </NavLink>
        <NavLink className={navigationClassName} to={`${path}/workers`}>
          <FiUser aria-hidden="true" className="size-4 shrink-0" />
          Workers
        </NavLink>
      </nav>
    </div>
  )
}

function navigationClassName({ isActive }: { isActive: boolean }) {
  return `flex min-h-11 items-center gap-2 rounded-control px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 ${isActive ? 'bg-blue-50 text-brand-700' : 'text-muted hover:bg-slate-100 hover:text-ink'}`
}
