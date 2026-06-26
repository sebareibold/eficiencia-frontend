import api from './axiosInstance'
import type {
  EjercicioCatalogo,
  CreateEjercicioCatalogoPayload,
  UpdateEjercicioCatalogoPayload,
  EjerciciosCatalogoFilters,
} from '../types/ejercicio-catalogo.types'

function mapEjercicio(e: any): EjercicioCatalogo {
  return {
    id: String(e.id),
    nombre: e.nombre,
    descripcion: e.descripcion ?? undefined,
    videoUrl: e.videoUrl ?? undefined,
    patronMovimiento: e.patronMovimiento ?? undefined,
    dificultad: e.dificultad ?? undefined,
    categoriaId: e.categoriaId ?? undefined,
    categoria: e.categoria ?? undefined,
    activo: e.activo,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

export const ejerciciosApi = {
  getAll: (filters?: EjerciciosCatalogoFilters): Promise<EjercicioCatalogo[]> =>
    api.get('/ejercicios', { params: filters }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapEjercicio)
    ),

  getById: (id: string): Promise<EjercicioCatalogo> =>
    api.get(`/ejercicios/${id}`).then(r => mapEjercicio(r.data)),

  create: (payload: CreateEjercicioCatalogoPayload): Promise<EjercicioCatalogo> =>
    api.post('/ejercicios', payload).then(r => mapEjercicio(r.data)),

  update: (id: string, payload: UpdateEjercicioCatalogoPayload): Promise<EjercicioCatalogo> =>
    api.patch(`/ejercicios/${id}`, payload).then(r => mapEjercicio(r.data)),

  remove: (id: string): Promise<void> =>
    api.delete(`/ejercicios/${id}`).then(() => undefined),
}
