import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '../api/clients.api'
import { QK } from '../lib/queryKeys'

export function useClients() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.clients.all(),
    queryFn:  () => clientsApi.getAll(),
    staleTime: 30_000,
  })

  return {
    clients:  data ?? [],
    isLoading: isPending,
    error:    error ? (error as Error).message : null,
    refetch:  () => { refetch() },
  }
}
