import api from './axiosInstance'
import type { Expense, CreateExpenseDto, UpdateExpenseDto } from '../types/expense.types'

export const expensesApi = {
  getAll: (params?: { month?: string; category?: string }) =>
    api.get<Expense[]>('/expenses', { params }).then((r) => r.data),
  create: (dto: CreateExpenseDto) => api.post<Expense>('/expenses', dto).then((r) => r.data),
  update: (id: number, dto: UpdateExpenseDto) =>
    api.patch<Expense>(`/expenses/${id}`, dto).then((r) => r.data),
  remove: (id: number) => api.delete(`/expenses/${id}`),
}
