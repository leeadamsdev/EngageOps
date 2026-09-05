import { NameCreationForm } from '../../components/NameCreationForm'
import { HttpError } from '../../lib/http'
import { workerNameMaxLength, type WorkerSummary } from './api'
import { useCreateWorker } from './useCreateWorker'

interface WorkerCreationFormProps {
  userId: string
  organisationId: string
  organisationName: string | undefined
  onCancel: () => void
  onCreated: (worker: WorkerSummary) => void
}

export function WorkerCreationForm({
  userId,
  organisationId,
  organisationName,
  onCancel,
  onCreated,
}: WorkerCreationFormProps) {
  const createWorker = useCreateWorker(userId, organisationId)
  const serverError =
    createWorker.data?.outcome === 'invalidInput'
      ? createWorker.data.errors.name?.join(' ')
      : undefined
  const error = createWorker.error
  const requestError = !error
    ? null
    : error instanceof HttpError && error.status === 404
      ? 'We couldn’t add this worker because the organisation is no longer available.'
      : 'We couldn’t add this worker right now. Check your connection and try again.'

  return (
    <NameCreationForm
      heading="Add worker"
      description={
        organisationName
          ? `Add a worker managed by ${organisationName}.`
          : 'Add a worker managed by this organisation.'
      }
      label="Worker name"
      pendingLabel="Adding worker…"
      autoComplete="name"
      maxLength={workerNameMaxLength}
      isPending={createWorker.isPending}
      serverError={serverError}
      requestError={requestError}
      onChange={() => {
        createWorker.reset()
      }}
      onCancel={onCancel}
      onSubmit={(name) => {
        createWorker.mutate(name, {
          onSuccess: (result) => {
            if (result.outcome === 'created') onCreated(result.worker)
          },
        })
      }}
    />
  )
}
