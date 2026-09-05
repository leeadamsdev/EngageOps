import { FiArrowRight, FiUser, FiUsers } from 'react-icons/fi'
import { Link, Navigate, useParams } from 'react-router'
import { ListLoading } from '../../components/ListLoading'
import { HttpError } from '../../lib/http'
import { useClients } from '../clients/useClients'
import { useWorkers } from '../workers/useWorkers'
import { OrganisationUnavailable } from './OrganisationUnavailable'
import { useOrganisations } from './useOrganisations'

export function OrganisationOverviewPage({ userId }: { userId: string }) {
  const { organisationId } = useParams<{ organisationId: string }>()
  const organisations = useOrganisations(userId)

  if (!organisationId) return <Navigate replace to="/organisations" />
  if (organisations.isPending) return <ListLoading label="Loading workspace…" />
  if (organisations.isError) {
    return (
      <OverviewError
        isRetrying={organisations.isFetching}
        onRetry={() => void organisations.refetch()}
      />
    )
  }
  const organisation = organisations.data.find(
    (item) => item.id.toLowerCase() === organisationId.toLowerCase(),
  )
  if (!organisation) return <OrganisationUnavailable />

  return (
    <OverviewContent
      key={organisation.id}
      userId={userId}
      organisationId={organisation.id}
      organisationName={organisation.name}
    />
  )
}

function OverviewContent({
  userId,
  organisationId,
  organisationName,
}: {
  userId: string
  organisationId: string
  organisationName: string
}) {
  const clients = useClients(userId, organisationId, 1)
  const workers = useWorkers(userId, organisationId, 1)
  if (
    [clients.error, workers.error].some(
      (error) => error instanceof HttpError && error.status === 404,
    )
  ) {
    return <OrganisationUnavailable />
  }

  return (
    <section aria-labelledby="overview-heading">
      <p className="text-xs font-semibold tracking-[0.12em] text-brand-700 uppercase">
        Overview
      </p>
      <h1
        id="overview-heading"
        className="mt-3 text-3xl font-semibold tracking-[-0.03em] wrap-anywhere text-ink sm:text-4xl"
      >
        {organisationName}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
        Your organisation’s workspace. Manage clients and workers from here.
      </p>
      <div className="mt-8 sm:mt-10">
        {clients.isError || workers.isError ? (
          <OverviewError
            isRetrying={clients.isFetching || workers.isFetching}
            onRetry={() => {
              void clients.refetch()
              void workers.refetch()
            }}
          />
        ) : clients.isPending || workers.isPending ? (
          <ListLoading label="Loading overview…" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
            <OverviewSummary
              organisationId={organisationId}
              resource="clients"
              title="Clients"
              totalCount={clients.data.totalCount}
            />
            <OverviewSummary
              organisationId={organisationId}
              resource="workers"
              title="Workers"
              totalCount={workers.data.totalCount}
            />
          </div>
        )}
      </div>
    </section>
  )
}

function OverviewSummary({
  organisationId,
  resource,
  title,
  totalCount,
}: {
  organisationId: string
  resource: 'clients' | 'workers'
  title: string
  totalCount: number
}) {
  const Icon = resource === 'clients' ? FiUsers : FiUser
  return (
    <Link
      aria-label={`View ${resource}, ${String(totalCount)} total`}
      to={`/organisations/${encodeURIComponent(organisationId)}/${resource}`}
      className="group rounded-panel border border-line bg-surface p-6 shadow-panel transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
    >
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="size-5 text-brand-700" />
        <h2 className="text-base font-semibold text-ink">{title}</h2>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-ink">
        {totalCount}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">
        {totalCount === 0
          ? `Add your first ${resource === 'clients' ? 'client' : 'worker'} to get started.`
          : `${title} in this organisation.`}
      </p>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
        View {resource}
        <FiArrowRight aria-hidden="true" className="size-4" />
      </span>
    </Link>
  )
}

function OverviewError({
  isRetrying,
  onRetry,
}: {
  isRetrying: boolean
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-panel border border-red-200 bg-red-50 p-6 sm:p-8"
    >
      <h2 className="text-lg font-semibold text-ink">
        We couldn’t load this overview
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Check your connection and try again.
      </p>
      <button
        type="button"
        className="button-primary mt-5 min-h-11 px-4"
        disabled={isRetrying}
        onClick={onRetry}
      >
        {isRetrying ? 'Trying again…' : 'Try again'}
      </button>
    </div>
  )
}
