import { NameCreationForm } from '../../components/NameCreationForm'
import { HttpError } from '../../lib/http'
import { clientNameMaxLength, type ClientSummary } from './api'
import { useCreateClient } from './useCreateClient'

interface ClientCreationFormProps {
  userId: string
  organisationId: string
  organisationName: string | undefined
  onCancel: () => void
  onCreated: (client: ClientSummary) => void
}

export function ClientCreationForm({
  userId,
  organisationId,
  organisationName,
  onCancel,
  onCreated,
}: ClientCreationFormProps) {
  const createClient = useCreateClient(userId, organisationId)
  const serverError =
    createClient.data?.outcome === 'invalidInput'
      ? createClient.data.errors.name?.join(' ')
      : undefined
  const error = createClient.error
  const requestError = !error
    ? null
    : error instanceof HttpError && error.status === 404
      ? 'We couldn’t add this client because the organisation is no longer available.'
      : 'We couldn’t add this client right now. Check your connection and try again.'

  return (
    <NameCreationForm
      heading="Add client"
      description={
        organisationName
          ? `Add a client managed by ${organisationName}.`
          : 'Add a client managed by this organisation.'
      }
      label="Client name"
      pendingLabel="Adding client…"
      autoComplete="organization"
      maxLength={clientNameMaxLength}
      isPending={createClient.isPending}
      serverError={serverError}
      requestError={requestError}
      onChange={() => {
        createClient.reset()
      }}
      onCancel={onCancel}
      onSubmit={(name) => {
        createClient.mutate(name, {
          onSuccess: (result) => {
            if (result.outcome === 'created') onCreated(result.client)
          },
        })
      }}
    />
  )
}
