import api from './axiosInstance'

export interface CategoriaEjercicio {
  id: string
  nombre: string
  orden: number
  activo: boolean
  createdAt: string
  updatedAt: string
}

export const categoriasEjercicioApi = {
  getAll: async (soloActivos?: boolean): Promise<CategoriaEjercicio[]> => {
    const params = soloActivos ? { soloActivos: 'true' } : {}
    const r = await api.get('/categorias-ejercicio', { params })
    return Array.isArray(r.data) ? r.data : []
  },

  create: async (dto: { nombre: string; orden?: number }): Promise<CategoriaEjercicio> => {
    const r = await api.post('/categorias-ejercicio', dto)
    return r.data
  },

  update: async (id: string, dto: Partial<{ nombre: string; activo: boolean; orden: number }>): Promise<CategoriaEjercicio> => {
    const r = await api.patch(`/categorias-ejercicio/${id}`, dto)
    return r.data
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/categorias-ejercicio/${id}`)
  },
}
