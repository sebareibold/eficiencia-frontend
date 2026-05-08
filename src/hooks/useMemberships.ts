import { useState, useEffect, useCallback } from 'react'
import { membershipsApi } from '../api/memberships.api'
import type { Membership } from '../types/membership.types'

export function useMemberships() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await membershipsApi.getAll()
      setMemberships(data)
    } catch {
      setError('No se pudieron cargar las membresías')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { memberships, isLoading, error, refetch: fetch }
}
