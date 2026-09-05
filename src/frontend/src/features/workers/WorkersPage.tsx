import { useEffect, useRef, useState } from 'react'
import {
  FiAlertCircle,
  FiCheckCircle,
  FiPlus,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi'
import { Navigate, useParams } from 'react-router'
import { ListLoading } from '../../components/ListLoading'
import { Pagination } from '../../components/Pagination'
import { HttpError } from '../../lib/http'
import { OrganisationBreadcrumb } from '../organisations/OrganisationBreadcrumb'
import { isOrganisationAccessError } from '../organisations/isOrganisationAccessError'
import { OrganisationUnavailable } from '../organisations/OrganisationUnavailable'
import { useOrganisations } from '../organisations/useOrganisations'
import type { WorkerPage, WorkerSummary } from './api'
import { WorkerCreationForm } from './WorkerCreationForm'
import { useWorkers } from './useWorkers'

interface WorkersPageProps {
  userId: string
}

export function WorkersPage({ userId }: WorkersPageProps) {
  const { organisationId } = useParams<{ organisationId: string }>()

  return organisationId ? (
    <WorkersContent
      key={organisationId}
      organisationId={organisationId}
      userId={userId}
    />
  ) : (
    <Navigate replace to="/organisations" />
  )
}

interface WorkersContentProps {
  userId: string
  organisationId: string
}

function WorkersContent({ userId, organisationId }: WorkersContentProps) {
  const [page, setPage] = useState(1)
  const [isCreating, setIsCreating] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>()
  const addWorkerButton = useRef<HTMLButtonElement>(null)
  const shouldRestoreAddWorkerFocus = useRef(false)
  const organisations = useOrganisations(userId)
  const workers = useWorkers(userId, organisationId, page)
  const organisation = organisations.isSuccess
    ? organisations.data.find(
        (candidate) =>
          candidate.id.toLowerCase() === organisationId.toLowerCase(),
      )
    : undefined
  const organisationUnavailable =
    workers.error instanceof HttpError && workers.error.status === 404

  useEffect(() => {
    if (
      !isCreating &&
      shouldRestoreAddWorkerFocus.current &&
      addWorkerButton.current
    ) {
      addWorkerButton.current.focus()
      shouldRestoreAddWorkerFocus.current = false
    }
  }, [isCreating, workers.isSuccess])

  function closeCreationForm() {
    shouldRestoreAddWorkerFocus.current = true
    setIsCreating(false)
  }

  function handleWorkerCreated(worker: WorkerSummary) {
    setSuccessMessage(`${worker.name} was added.`)
    closeCreationForm()
  }

  return (
    <section aria-labelledby="workers-heading">
      <OrganisationBreadcrumb
        organisationId={organisationId}
        currentPage="Workers"
        organisationName={organisation?.name}
      />

      <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.12em] wrap-anywhere text-brand-700 uppercase">
            {organisation?.name ?? 'Organisation'}
          </p>
          <h1
            className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl"
            id="workers-heading"
          >
            Workers
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            Manage this organisation’s workers.
          </p>
        </div>

        {workers.isSuccess && !isCreating && (
          <button
            className="button-primary min-h-11 w-full shrink-0 px-5 sm:w-auto"
            type="button"
            ref={addWorkerButton}
            onClick={() => {
              setSuccessMessage(undefined)
              setIsCreating(true)
            }}
          >
            <FiPlus aria-hidden="true" className="size-4" />
            Add worker
          </button>
        )}
      </div>

      {isCreating && !isOrganisationAccessError(workers.error) && (
        <div className="mt-8">
          <WorkerCreationForm
            organisationId={organisationId}
            organisationName={organisation?.name}
            userId={userId}
            onCancel={closeCreationForm}
            onCreated={handleWorkerCreated}
          />
        </div>
      )}

      {successMessage && (
        <p
          className="mt-8 flex items-center gap-2 rounded-control border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm wrap-anywhere text-emerald-800"
          role="status"
        >
          <FiCheckCircle aria-hidden="true" className="size-4 shrink-0" />
          {successMessage}
        </p>
      )}

      <div className="mt-8 sm:mt-10">
        {workers.isPending && <ListLoading label="Loading workers…" />}

        {workers.isError && organisationUnavailable && (
          <OrganisationUnavailable />
        )}

        {workers.isError && !organisationUnavailable && (
          <WorkersError
            isRetrying={workers.isFetching}
            onRetry={() => void workers.refetch()}
          />
        )}

        {workers.isSuccess && workers.data.totalCount === 0 && (
          <WorkersEmpty organisationName={organisation?.name} />
        )}

        {workers.isSuccess && workers.data.totalCount > 0 && (
          <WorkerList
            workerPage={workers.data}
            requestedPage={page}
            isFetching={workers.isFetching}
            onNextPage={() => {
              setPage((current) => current + 1)
            }}
            onPreviousPage={() => {
              setPage((current) => current - 1)
            }}
          />
        )}
      </div>
    </section>
  )
}

interface WorkerListProps {
  workerPage: WorkerPage
  requestedPage: number
  isFetching: boolean
  onNextPage: () => void
  onPreviousPage: () => void
}

function WorkerList({
  workerPage,
  requestedPage,
  isFetching,
  onNextPage,
  onPreviousPage,
}: WorkerListProps) {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <h2 className="text-sm font-semibold text-ink">Organisation workers</h2>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          {workerPage.totalCount}
        </span>
      </div>

      <ul
        aria-label="Workers"
        aria-busy={isFetching}
        className="divide-y divide-line"
      >
        {workerPage.items.map((worker) => (
          <li
            className="flex items-center gap-4 px-5 py-5 sm:px-6"
            key={worker.id}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-control bg-blue-50 text-brand-700">
              <FiUser aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold wrap-anywhere text-ink">
                {worker.name}
              </p>
              <p className="mt-1 text-sm text-muted">Worker</p>
            </div>
          </li>
        ))}
      </ul>

      <Pagination
        label="Worker pages"
        page={workerPage.page}
        pageSize={workerPage.pageSize}
        totalCount={workerPage.totalCount}
        requestedPage={requestedPage}
        isFetching={isFetching}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
      />
    </div>
  )
}

interface WorkersErrorProps {
  isRetrying: boolean
  onRetry: () => void
}

function WorkersError({ isRetrying, onRetry }: WorkersErrorProps) {
  return (
    <div
      className="rounded-panel border border-red-200 bg-red-50 p-6 sm:p-8"
      role="alert"
    >
      <FiAlertCircle aria-hidden="true" className="size-6 text-red-700" />
      <h2 className="mt-4 text-lg font-semibold text-ink">
        We couldn’t load this organisation’s workers
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
        Check your connection and try again.
      </p>
      <button
        className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 transition-colors duration-200 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700 disabled:cursor-wait disabled:text-red-400"
        type="button"
        disabled={isRetrying}
        onClick={onRetry}
      >
        <FiRefreshCw
          aria-hidden="true"
          className={`size-4 ${isRetrying ? 'animate-spin motion-reduce:animate-none' : ''}`}
        />
        {isRetrying ? 'Trying again…' : 'Try again'}
      </button>
    </div>
  )
}

interface WorkersEmptyProps {
  organisationName: string | undefined
}

function WorkersEmpty({ organisationName }: WorkersEmptyProps) {
  return (
    <div className="rounded-panel border border-line bg-surface px-6 py-12 text-center shadow-panel sm:px-8 sm:py-16">
      <span className="mx-auto grid size-12 place-items-center rounded-control bg-blue-50 text-brand-700">
        <FiUser aria-hidden="true" className="size-6" />
      </span>
      <h2 className="mt-5 text-lg font-semibold text-ink">No workers yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 wrap-anywhere text-muted">
        {organisationName
          ? `${organisationName} does not have any workers yet.`
          : 'This organisation does not have any workers yet.'}
      </p>
    </div>
  )
}
