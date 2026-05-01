import api from './axiosInstance'

export interface MonthlyPoint {
  month: string
  amount: number
}

export interface PaymentMethodPoint {
  method: string
  amount: number
  count?: number
}

export interface DashboardStats {
  // Current period
  totalIncome: number
  totalExpenses: number
  netProfit: number
  // Previous period (for % change calculation)
  previousIncome: number
  previousExpenses: number
  previousProfit: number
  // Clients
  activeClients: number
  newClients: number
  expiringClients: number
  debtClients: number
  // Chart series
  incomeByMonth: MonthlyPoint[]
  expensesByMonth: MonthlyPoint[]
  incomeByMethod: PaymentMethodPoint[]
}

export const dashboardApi = {
  getStats: (params?: { from?: string; to?: string }) =>
    api.get<DashboardStats>('/dashboard', { params }).then((r) => r.data),
}
