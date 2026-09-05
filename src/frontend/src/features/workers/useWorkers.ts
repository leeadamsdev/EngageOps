import { useQuery } from '@tanstack/react-query'
import { useInvalidateSessionOnUnauthorized } from '../auth/useInvalidateSessionOnUnauthorized'
import { getWorkers } from './api'

export function workersQueryKey(userId: string, organisationId: string) {
  return ['workers', userId, organisationId] as const
}

export function useWorkers(
  userId: string,
  organisationId: string,
  page: number,
) {
  const workers = useQuery({
    queryKey: [...workersQueryKey(userId, organisationId), page],
    queryFn: ({ signal }) => getWorkers(organisationId, page, signal),
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.state.status === 'success' &&
      previousQuery.queryKey[1] === userId &&
      previousQuery.queryKey[2] === organisationId
        ? previousData
        : undefined,
    retry: false,
  })

  useInvalidateSessionOnUnauthorized(workers.error)

  return workers
}
