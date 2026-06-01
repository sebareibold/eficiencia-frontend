import { useQuery } from '@tanstack/react-query'
import { membershipsApi } from '../api/memberships.api'
import { QK } from '../lib/queryKeys'

export function useMemberships() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.plans.all(),
    queryFn:  () => membershipsApi.getAll(),
    staleTime: 300_000, // 5 min — los planes cambian raramente
  })

  return {
    memberships: data ?? [],
    isLoading:   isPending,
    error:       error ? (error as Error).message : null,
    refetch:     () => { refetch() },
  }
}
