import api from './axiosInstance'
import type { CancelacionTurno } from '../types/cancelaciones.types'

export const cancelacionesApi = {
  getByTurno: (turnoId: string): Promise<CancelacionTurno[]> =>
    api.get('/cancelaciones', { params: { turnoId } })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  create: (data: { turnoId: string; fecha: string; motivo?: string }): Promise<CancelacionTurno> =>
    api.post('/cancelaciones', data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/cancelaciones/${id}`).then(() => undefined),
}
