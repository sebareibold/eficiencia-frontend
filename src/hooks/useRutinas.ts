import { useQuery } from '@tanstack/react-query'
import { rutinasApi } from '../api/rutinas.api'
import { QK } from '../lib/queryKeys'

export function useRutinas(clienteId: string | undefined) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.rutinas.byCliente(clienteId),
    queryFn:  async () => {
      const data = await rutinasApi.getByCliente(clienteId!)
      return [...data].sort((a, b) => {
        if (a.activa && !b.activa) return -1
        if (!a.activa && b.activa) return 1
        return 0
      })
    },
    enabled:   !!clienteId,
    staleTime: 30_000,
  })

  return {
    rutinas:   data ?? [],
    isLoading: !!clienteId && isPending,
    error:     error ? (error as Error).message : null,
    refetch:   () => { refetch() },
  }
}
