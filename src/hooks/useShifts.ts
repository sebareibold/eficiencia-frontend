import { useQuery } from '@tanstack/react-query'
import { shiftsApi } from '../api/shifts.api'
import { QK } from '../lib/queryKeys'

export function useShifts() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.shifts.all(),
    queryFn:  () => shiftsApi.getAll(),
    staleTime: 60_000,
  })

  return {
    shifts:    data ?? [],
    isLoading: isPending,
    error:     error ? (error as Error).message : null,
    refetch:   () => { refetch() },
  }
}
