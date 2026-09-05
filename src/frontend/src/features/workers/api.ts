import { getAntiforgeryToken } from '../../lib/antiforgery'
import { HttpError } from '../../lib/http'
import { isRecord } from '../../lib/json'
import { getValidationProblemFieldErrors } from '../../lib/validationProblem'

export const workersPageSize = 20
export const workerNameMaxLength = 200

export interface WorkerSummary {
  id: string
  organisationId: string
  name: string
}

export interface WorkerPage {
  items: WorkerSummary[]
  page: number
  pageSize: number
  totalCount: number
}

interface CreateWorkerValidationErrors {
  name?: string[]
}

export type CreateWorkerResult =
  | { outcome: 'created'; worker: WorkerSummary }
  | { outcome: 'invalidInput'; errors: CreateWorkerValidationErrors }

export async function getWorkers(
  organisationId: string,
  page: number,
  signal: AbortSignal,
): Promise<WorkerPage> {
  const query = new URLSearchParams({
    page: page.toString(),
    pageSize: workersPageSize.toString(),
  })
  const response = await fetch(
    `/api/organisations/${encodeURIComponent(organisationId)}/workers?${query.toString()}`,
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    },
  )

  if (!response.ok) {
    throw new HttpError(
      `Workers request failed with status ${response.status.toString()}.`,
      response.status,
    )
  }

  const workerPage: unknown = await response.json()
  if (!isWorkerPage(workerPage, organisationId, page)) {
    throw new Error('Workers response was invalid.')
  }

  return workerPage
}

export async function createWorker(
  organisationId: string,
  name: string,
): Promise<CreateWorkerResult> {
  const antiforgeryToken = await getAntiforgeryToken()
  const response = await fetch(
    `/api/organisations/${encodeURIComponent(organisationId)}/workers`,
    {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': antiforgeryToken,
      },
      body: JSON.stringify({ name }),
    },
  )

  if (response.status === 201) {
    const worker: unknown = await response.json()
    if (!isWorkerSummary(worker, organisationId)) {
      throw new Error('Create worker response was invalid.')
    }

    return { outcome: 'created', worker }
  }

  if (response.status === 400) {
    const responseBody: unknown = await response.json()
    const nameErrors = getValidationProblemFieldErrors(responseBody, 'name')
    if (nameErrors) {
      return { outcome: 'invalidInput', errors: { name: nameErrors } }
    }
  }

  throw new HttpError(
    `Create worker request failed with status ${response.status.toString()}.`,
    response.status,
  )
}

function isWorkerPage(
  value: unknown,
  organisationId: string,
  requestedPage: number,
): value is WorkerPage {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every((item) => isWorkerSummary(item, organisationId)) &&
    value.page === requestedPage &&
    value.pageSize === workersPageSize &&
    isNonNegativeInteger(value.totalCount)
  )
}

function isWorkerSummary(
  value: unknown,
  organisationId: string,
): value is WorkerSummary {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.organisationId === 'string' &&
    value.organisationId.toLowerCase() === organisationId.toLowerCase() &&
    typeof value.name === 'string'
  )
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}
