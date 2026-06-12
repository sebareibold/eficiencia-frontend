import api from './axiosInstance'

export interface PatronMovimientoConfig {
  id: string
  clave: string
  label: string
  descripcion?: string
  activo: boolean
  orden: number
  createdAt: string
  updatedAt: string
}

export interface CreatePatronDto {
  clave: string
  label: string
  descripcion?: string
  activo?: boolean
  orden?: number
}

export const patronesApi = {
  getAll: async (soloActivos?: boolean): Promise<PatronMovimientoConfig[]> => {
    const params = soloActivos ? { soloActivos: 'true' } : {}
    const r = await api.get('/patrones', { params })
    return Array.isArray(r.data) ? r.data : []
  },

  create: async (dto: CreatePatronDto): Promise<PatronMovimientoConfig> => {
    const r = await api.post('/patrones', dto)
    return r.data
  },

  update: async (id: string, dto: Partial<CreatePatronDto>): Promise<PatronMovimientoConfig> => {
    const r = await api.patch(`/patrones/${id}`, dto)
    return r.data
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/patrones/${id}`)
  },
}
