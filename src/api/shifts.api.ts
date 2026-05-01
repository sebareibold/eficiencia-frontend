import api from './axiosInstance'
import type { Shift, CreateShiftDto, UpdateShiftDto } from '../types/shift.types'

export const shiftsApi = {
  getAll: () => api.get<Shift[]>('/shifts').then((r) => r.data),
  getById: (id: number) => api.get<Shift>(`/shifts/${id}`).then((r) => r.data),
  create: (dto: CreateShiftDto) => api.post<Shift>('/shifts', dto).then((r) => r.data),
  update: (id: number, dto: UpdateShiftDto) =>
    api.patch<Shift>(`/shifts/${id}`, dto).then((r) => r.data),
  remove: (id: number) => api.delete(`/shifts/${id}`),
}
