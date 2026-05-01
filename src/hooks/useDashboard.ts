import { useState, useEffect, useCallback } from 'react'
import { dashboardApi, type DashboardStats } from '../api/dashboard.api'

export function useDashboard(params?: { from?: string; to?: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await dashboardApi.getStats(params)
      setStats(data)
    } catch {
      setError('No se pudieron cargar las estadísticas')
    } finally {
      setIsLoading(false)
    }
  }, [params?.from, params?.to])

  useEffect(() => { fetch() }, [fetch])

  return { stats, isLoading, error, refetch: fetch }
}
