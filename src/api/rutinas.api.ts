import api from './axiosInstance'
import type {
  Rutina, CreateRutinaPayload, UpdateRutinaPayload,
  Ejercicio, CreateEjercicioPayload, UpdateEjercicioPayload,
} from '../types/rutina.types'

function mapRutina(r: any): Rutina {
  return {
    id: String(r.id),
    clienteId: String(r.clienteId),
    profesorId: String(r.profesorId),
    nombre: r.nombre,
    descripcion: r.descripcion ?? undefined,
    activa: r.activa,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ejercicios: (r.ejercicios ?? []).map(mapEjercicio),
    cliente: r.cliente,
    profesor: r.profesor,
  }
}

function mapEjercicio(e: any): Ejercicio {
  return {
    id: String(e.id),
    rutinaId: String(e.rutinaId),
    nombre: e.nombre,
    series: e.series,
    repeticiones: e.repeticiones,
    peso: e.peso ?? undefined,
    notas: e.notas ?? undefined,
    orden: e.orden ?? 0,
  }
}

export const rutinasApi = {
  getByCliente: (clienteId: string): Promise<Rutina[]> =>
    api.get('/rutinas', { params: { clienteId } }).then(r =>
      (Array.isArray(r.data) ? r.data : []).map(mapRutina)
    ),

  getById: (id: string): Promise<Rutina> =>
    api.get(`/rutinas/${id}`).then(r => mapRutina(r.data)),

  create: (payload: CreateRutinaPayload): Promise<Rutina> =>
    api.post('/rutinas', payload).then(r => mapRutina(r.data)),

  update: (id: string, payload: UpdateRutinaPayload): Promise<Rutina> =>
    api.patch(`/rutinas/${id}`, payload).then(r => mapRutina(r.data)),

  remove: (id: string): Promise<void> =>
    api.delete(`/rutinas/${id}`).then(() => undefined),

  addEjercicio: (rutinaId: string, payload: CreateEjercicioPayload): Promise<Ejercicio> =>
    api.post(`/rutinas/${rutinaId}/ejercicios`, payload).then(r => mapEjercicio(r.data)),

  updateEjercicio: (rutinaId: string, ejercicioId: string, payload: UpdateEjercicioPayload): Promise<Ejercicio> =>
    api.patch(`/rutinas/${rutinaId}/ejercicios/${ejercicioId}`, payload).then(r => mapEjercicio(r.data)),

  removeEjercicio: (rutinaId: string, ejercicioId: string): Promise<void> =>
    api.delete(`/rutinas/${rutinaId}/ejercicios/${ejercicioId}`).then(() => undefined),
}
