import api from './axiosInstance'

export interface DashboardStats {
  totalIncome: number
  totalExpenses: number
  netProfit: number
  activeClients: number
  incomeByMonth: { month: string; amount: number }[]
  incomeByMethod: { method: string; amount: number }[]
}

export const dashboardApi = {
  getStats: (params?: { from?: string; to?: string }) =>
    api.get<DashboardStats>('/dashboard', { params }).then((r) => r.data),
}
