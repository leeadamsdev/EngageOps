import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useInvalidateSessionOnUnauthorized } from '../auth/useInvalidateSessionOnUnauthorized'
import { createWorker } from './api'
import { workersQueryKey } from './useWorkers'

export function useCreateWorker(userId: string, organisationId: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (name: string) => createWorker(organisationId, name),
    onSuccess: async (result) => {
      if (result.outcome === 'created') {
        await queryClient.invalidateQueries({
          queryKey: workersQueryKey(userId, organisationId),
        })
      }
    },
  })

  useInvalidateSessionOnUnauthorized(mutation.error)

  return mutation
}
