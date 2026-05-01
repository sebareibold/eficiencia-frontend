import api from './axiosInstance'
import type { Payment, CreatePaymentDto } from '../types/payment.types'

export const paymentsApi = {
  getAll: (params?: { month?: string; clientId?: number }) =>
    api.get<Payment[]>('/payments', { params }).then((r) => r.data),
  create: (dto: CreatePaymentDto) => api.post<Payment>('/payments', dto).then((r) => r.data),
  toggleInvoiced: (id: number) =>
    api.patch<Payment>(`/payments/${id}/invoiced`).then((r) => r.data),
  remove: (id: number) => api.delete(`/payments/${id}`),
}
