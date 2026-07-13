import api from './axiosInstance'
import type {
  AusenciaTurno,
  RecuperacionClase,
  CupoInfo,
  CreateAusenciaPayload,
  CreateRecuperacionPayload,
  UpdateAusenciaPayload,
  UpdateRecuperacionPayload,
} from '../types/reposicion.types'

function unwrap<T>(r: any): T {
  return r.data ?? r
}

export const reposicionesApi = {
  // ─── Listar ──────────────────────────────────────────────────────────────
  getAll: (params?: {
    clienteId?: string
    turnoId?: string
    fecha?: string
    estado?: string
  }): Promise<AusenciaTurno[]> =>
    api.get('/reposiciones', { params }).then(unwrap),

  getByTurnoFecha: (turnoId: string, fecha: string): Promise<RecuperacionClase[]> =>
    api.get(`/reposiciones/turno/${turnoId}`, { params: { fecha } }).then(unwrap),

  // ─── Cupo ────────────────────────────────────────────────────────────────
  getCupo: (turnoId: string, fecha: string): Promise<CupoInfo> =>
    api.get(`/reposiciones/cupo/${turnoId}`, { params: { fecha } }).then(unwrap),

  // ─── Ausencias ───────────────────────────────────────────────────────────
  createAusencia: (payload: CreateAusenciaPayload): Promise<AusenciaTurno> =>
    api.post('/reposiciones/ausencia', payload).then(unwrap),

  updateAusencia: (id: string, payload: UpdateAusenciaPayload): Promise<AusenciaTurno> =>
    api.patch(`/reposiciones/ausencia/${id}`, payload).then(unwrap),

  deleteAusencia: (id: string): Promise<void> =>
    api.delete(`/reposiciones/ausencia/${id}`).then(() => undefined),

  // ─── Recuperaciones ──────────────────────────────────────────────────────
  createRecuperacion: (ausenciaId: string, payload: CreateRecuperacionPayload): Promise<RecuperacionClase> =>
    api.post(`/reposiciones/ausencia/${ausenciaId}/recuperar`, payload).then(unwrap),

  updateRecuperacion: (id: string, payload: UpdateRecuperacionPayload): Promise<RecuperacionClase> =>
    api.patch(`/reposiciones/recuperacion/${id}`, payload).then(unwrap),

  cancelarRecuperacion: (id: string): Promise<void> =>
    api.delete(`/reposiciones/recuperacion/${id}`).then(() => undefined),
}
