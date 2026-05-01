import { useState, useEffect, useCallback } from 'react'
import { dashboardApi, type DashboardStats } from '../api/dashboard.api'

const MOCK_STATS: DashboardStats = {
  totalIncome: 245000,
  totalExpenses: 85000,
  netProfit: 160000,
  previousIncome: 198000,
  previousExpenses: 79000,
  previousProfit: 119000,
  activeClients: 87,
  newClients: 12,
  expiringClients: 8,
  debtClients: 5,
  incomeByMonth: [
    { month: 'Dic', amount: 165000 },
    { month: 'Ene', amount: 180000 },
    { month: 'Feb', amount: 195000 },
    { month: 'Mar', amount: 210000 },
    { month: 'Abr', amount: 198000 },
    { month: 'May', amount: 245000 },
  ],
  expensesByMonth: [
    { month: 'Dic', amount: 68000 },
    { month: 'Ene', amount: 72000 },
    { month: 'Feb', amount: 78000 },
    { month: 'Mar', amount: 83000 },
    { month: 'Abr', amount: 79000 },
    { month: 'May', amount: 85000 },
  ],
  incomeByMethod: [
    { method: 'Efectivo', amount: 147000, count: 52 },
    { method: 'Transferencia', amount: 78400, count: 28 },
    { method: 'Débito', amount: 19600, count: 7 },
  ],
}

export function useDashboard(params?: { from?: string; to?: string }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isMock, setIsMock] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setIsMock(false)
    try {
      const data = await dashboardApi.getStats(params)
      setStats(data)
    } catch {
      // Fallback to mock data so the dashboard is always usable during demos
      setStats(MOCK_STATS)
      setIsMock(true)
    } finally {
      setIsLoading(false)
    }
  }, [params?.from, params?.to])

  useEffect(() => { fetch() }, [fetch])

  return { stats, isLoading, isMock, error, refetch: fetch }
}
