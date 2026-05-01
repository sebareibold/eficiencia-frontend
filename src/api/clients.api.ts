import api from './axiosInstance'
import type { Client, CreateClientDto, UpdateClientDto } from '../types/client.types'

export const clientsApi = {
  getAll: () => api.get<Client[]>('/clients').then((r) => r.data),
  getById: (id: number) => api.get<Client>(`/clients/${id}`).then((r) => r.data),
  create: (dto: CreateClientDto) => api.post<Client>('/clients', dto).then((r) => r.data),
  update: (id: number, dto: UpdateClientDto) =>
    api.patch<Client>(`/clients/${id}`, dto).then((r) => r.data),
  remove: (id: number) => api.delete(`/clients/${id}`),
}
