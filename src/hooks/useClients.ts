import { useState, useEffect, useCallback } from 'react'
import { clientsApi } from '../api/clients.api'
import type { Client } from '../types/client.types'

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await clientsApi.getAll()
      setClients(data)
    } catch {
      setError('No se pudieron cargar los clientes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { clients, isLoading, error, refetch: fetch }
}
