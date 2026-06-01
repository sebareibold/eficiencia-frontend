import api from './axiosInstance'
import type { PlantillaRutinaData, TipoDistribucion, PatronMovimientoEnum } from '../types/rutina.types'

export interface CreateBloquePayload {
  letra: string
  orden: number
  patronMovimiento: PatronMovimientoEnum
  cantidadEjercicios: number
}

export interface CreateSesionPayload {
  numero: number
  nombre?: string
  bloques: CreateBloquePayload[]
}

export interface CreatePlantillaPayload {
  nombre: string
  tipo: TipoDistribucion
  cantidadSesiones: number
  sesiones: CreateSesionPayload[]
}

export interface ListarPlantillasParams {
  tipo?: TipoDistribucion
  cantidadSesiones?: number
  soloActivas?: boolean
}

export const plantillasApi = {
  getAll: async (params?: ListarPlantillasParams): Promise<PlantillaRutinaData[]> => {
    const r = await api.get('/plantillas-rutina', { params })
    return Array.isArray(r.data) ? r.data : []
  },

  getById: async (id: string): Promise<PlantillaRutinaData> => {
    const r = await api.get(`/plantillas-rutina/${id}`)
    return r.data
  },

  create: async (payload: CreatePlantillaPayload): Promise<PlantillaRutinaData> => {
    const r = await api.post('/plantillas-rutina', payload)
    return r.data
  },

  update: async (id: string, payload: CreatePlantillaPayload): Promise<PlantillaRutinaData> => {
    const r = await api.put(`/plantillas-rutina/${id}`, payload)
    return r.data
  },

  toggle: async (id: string): Promise<PlantillaRutinaData> => {
    const r = await api.patch(`/plantillas-rutina/${id}/toggle`)
    return r.data
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/plantillas-rutina/${id}`)
  },
}
