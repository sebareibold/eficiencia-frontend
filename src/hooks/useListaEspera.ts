import { useState, useEffect, useCallback } from 'react'
import { listaEsperaApi } from '../api/listaEspera.api'
import type { ListaEsperaEntry } from '../types/listaEspera.types'

export function useListaEspera(turnoId: string | null) {
  const [entries, setEntries] = useState<ListaEsperaEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!turnoId) { setEntries([]); return }
    setIsLoading(true)
    setError(null)
    try {
      const data = await listaEsperaApi.getByTurno(turnoId)
      setEntries(data)
    } catch {
      setError('No se pudo cargar la lista de espera')
    } finally {
      setIsLoading(false)
    }
  }, [turnoId])

  useEffect(() => { fetch() }, [fetch])

  return { entries, isLoading, error, refetch: fetch }
}
