import api from './axiosInstance'
import type { ExcepcionTurno } from '../types/excepcion.types'

function mapExcepcion(e: any): ExcepcionTurno {
  const nombre = e.profesor?.usuario
    ? `${e.profesor.usuario.nombre} ${e.profesor.usuario.apellido ?? ''}`.trim()
    : null
  return {
    id:             String(e.id),
    turnoId:        String(e.turnoId),
    fecha:          e.fecha,
    horaInicio:     e.horaInicio  ?? null,
    horaFin:        e.horaFin     ?? null,
    profesorId:     e.profesorId  ? String(e.profesorId) : null,
    profesorNombre: nombre,
    motivo:         e.motivo      ?? null,
  }
}

export const excepcionesApi = {
  getByTurno: (turnoId: string): Promise<ExcepcionTurno[]> =>
    api.get('/excepciones-turno', { params: { turnoId } })
      .then(r => (Array.isArray(r.data) ? r.data : []).map(mapExcepcion)),

  create: (data: {
    turnoId: string
    fecha: string
    horaInicio?: string
    horaFin?: string
    profesorId?: string
    motivo?: string
  }): Promise<ExcepcionTurno> =>
    api.post('/excepciones-turno', data).then(r => mapExcepcion(r.data)),

  update: (id: string, data: {
    horaInicio?: string | null
    horaFin?: string | null
    profesorId?: string | null
    motivo?: string | null
  }): Promise<ExcepcionTurno> =>
    api.patch(`/excepciones-turno/${id}`, data).then(r => mapExcepcion(r.data)),

  remove: (id: string): Promise<void> =>
    api.delete(`/excepciones-turno/${id}`),
}
