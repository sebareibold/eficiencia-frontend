import api from './axiosInstance'
import type {
  Rutina, CreateRutinaPayload, UpdateRutinaPayload,
  Semana, Sesion, Bloque, EjercicioPlan,
  CreateEjercicioPlanPayload, UpdateEjercicioPlanPayload,
  EjecucionCliente, CreateEjecucionPayload,
} from '../types/rutina.types'

export const rutinasApi = {
  // ─── Rutinas ───────────────────────────────────────────────────────────────
  getByCliente: async (clienteId: string): Promise<Rutina[]> => {
    const r = await api.get('/rutinas', { params: { clienteId } })
    return Array.isArray(r.data) ? r.data : []
  },

  getById: async (id: string): Promise<Rutina> => {
    const r = await api.get(`/rutinas/${id}`)
    return r.data
  },

  create: async (payload: CreateRutinaPayload): Promise<Rutina> => {
    const r = await api.post('/rutinas', payload)
    return r.data
  },

  update: async (id: string, payload: UpdateRutinaPayload): Promise<Rutina> => {
    const r = await api.patch(`/rutinas/${id}`, payload)
    return r.data
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/rutinas/${id}`)
  },

  // ─── Semanas ───────────────────────────────────────────────────────────────
  createSemana: async (rutinaId: string): Promise<Semana> => {
    const r = await api.post(`/rutinas/${rutinaId}/semanas`)
    return r.data
  },

  updateSemana: async (rutinaId: string, semanaId: string, nombre: string): Promise<Semana> => {
    const r = await api.patch(`/rutinas/${rutinaId}/semanas/${semanaId}`, { nombre })
    return r.data
  },

  clonarSemana: async (rutinaId: string, semanaId: string): Promise<Semana> => {
    const r = await api.post(`/rutinas/${rutinaId}/semanas/${semanaId}/clonar`)
    return r.data
  },

  deleteSemana: async (rutinaId: string, semanaId: string): Promise<void> => {
    await api.delete(`/rutinas/${rutinaId}/semanas/${semanaId}`)
  },

  // ─── Sesiones ──────────────────────────────────────────────────────────────
  createSesion: async (semanaId: string, dia: string): Promise<Sesion> => {
    const r = await api.post(`/rutinas/semanas/${semanaId}/sesiones`, { dia })
    return r.data
  },

  updateSesion: async (sesionId: string, dia: string): Promise<Sesion> => {
    const r = await api.patch(`/rutinas/sesiones/${sesionId}`, { dia })
    return r.data
  },

  deleteSesion: async (sesionId: string): Promise<void> => {
    await api.delete(`/rutinas/sesiones/${sesionId}`)
  },

  // ─── Bloques ───────────────────────────────────────────────────────────────
  createBloque: async (sesionId: string, letra: string): Promise<Bloque> => {
    const r = await api.post(`/rutinas/sesiones/${sesionId}/bloques`, { letra })
    return r.data
  },

  deleteBloque: async (bloqueId: string): Promise<void> => {
    await api.delete(`/rutinas/bloques/${bloqueId}`)
  },

  // ─── Ejercicios Plan ───────────────────────────────────────────────────────
  addEjercicio: async (bloqueId: string, payload: CreateEjercicioPlanPayload): Promise<EjercicioPlan> => {
    const r = await api.post(`/rutinas/bloques/${bloqueId}/ejercicios`, payload)
    return r.data
  },

  updateEjercicio: async (ejercicioId: string, payload: UpdateEjercicioPlanPayload): Promise<EjercicioPlan> => {
    const r = await api.patch(`/rutinas/ejercicios/${ejercicioId}`, payload)
    return r.data
  },

  deleteEjercicio: async (ejercicioId: string): Promise<void> => {
    await api.delete(`/rutinas/ejercicios/${ejercicioId}`)
  },

  // ─── Ejecuciones ───────────────────────────────────────────────────────────
  addEjecucion: async (ejercicioId: string, payload: CreateEjecucionPayload): Promise<EjecucionCliente> => {
    const r = await api.post(`/rutinas/ejercicios/${ejercicioId}/ejecuciones`, payload)
    return r.data
  },
}
