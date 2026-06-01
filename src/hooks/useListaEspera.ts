import { useQuery } from '@tanstack/react-query'
import { listaEsperaApi } from '../api/listaEspera.api'
import { QK } from '../lib/queryKeys'

export function useListaEspera(turnoId: string | null) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: QK.listaEspera.byTurno(turnoId),
    queryFn:  () => listaEsperaApi.getByTurno(turnoId!),
    enabled:  !!turnoId,
    staleTime: 30_000,
  })

  return {
    entries:   data ?? [],
    isLoading: !!turnoId && isPending,
    error:     error ? (error as Error).message : null,
    refetch:   () => { refetch() },
  }
}
