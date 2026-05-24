import api from './axiosInstance'
import type { DiaEspecial, TipoDiaEspecial } from '../types/dias-especiales.types'

export const diasEspecialesApi = {
  getAll: (mes?: string): Promise<DiaEspecial[]> =>
    api.get('/dias-especiales', { params: mes ? { mes } : undefined })
      .then((r) => (Array.isArray(r.data) ? r.data : [])),

  create: (data: {
    fecha: string
    tipo: TipoDiaEspecial
    motivo?: string
    horaDesde?: string
    horaHasta?: string
  }): Promise<DiaEspecial> =>
    api.post('/dias-especiales', data).then((r) => r.data),

  update: (id: string, data: {
    fecha?: string
    tipo?: TipoDiaEspecial
    motivo?: string
    horaDesde?: string
    horaHasta?: string
  }): Promise<DiaEspecial> =>
    api.patch(`/dias-especiales/${id}`, data).then((r) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/dias-especiales/${id}`).then(() => undefined),
}
