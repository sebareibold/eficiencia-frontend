import { useState, useEffect, useCallback } from 'react'
import { rutinasApi } from '../api/rutinas.api'
import type { Rutina } from '../types/rutina.types'

export function useRutinas(clienteId: string | undefined) {
  const [rutinas, setRutinas] = useState<Rutina[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!clienteId) { setRutinas([]); return }
    setIsLoading(true)
    setError(null)
    try {
      const data = await rutinasApi.getByCliente(clienteId)
      // Ordenar las rutinas activas al principio
      const sorted = [...data].sort((a, b) => {
        if (a.activa && !b.activa) return -1
        if (!a.activa && b.activa) return 1
        return 0
      })
      setRutinas(sorted)
    } catch {
      setError('No se pudieron cargar las rutinas')
    } finally {
      setIsLoading(false)
    }
  }, [clienteId])

  useEffect(() => { fetch() }, [fetch])

  return { rutinas, isLoading, error, refetch: fetch }
}
