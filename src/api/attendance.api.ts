import api from './axiosInstance'
import type { AttendanceRecord } from '../types/attendance.types'

function mapRecord(r: any): AttendanceRecord {
  const sala = r.turno?.sala ?? ''
  const inicio = r.turno?.horaInicio ?? ''
  const fin = r.turno?.horaFin ?? ''
  const shiftLabel =
    sala && inicio
      ? `Sala ${sala} · ${inicio}${fin ? `–${fin}` : ''}`
      : `Turno #${String(r.turnoId ?? '').slice(0, 6)}`
  return {
    id: r.id,
    clientId: r.clienteId,
    clientName: r.cliente ? `${r.cliente.nombre} ${r.cliente.apellido}` : '',
    shiftId: r.turnoId,
    shiftLabel,
    date: r.fecha,
    present: r.presente,
    conAviso: r.conAviso ?? false,
  }
}

export type TipoBloqueoAsistencia = 'CIERRE_TOTAL' | 'CANCELACION_TURNO' | 'HORARIO_REDUCIDO'

export interface VerificacionFecha {
  bloqueado: boolean
  motivo: string | null
  tipo: TipoBloqueoAsistencia | null
  horaDesde?: string
  horaHasta?: string
}

export interface EfectividadAsistencia {
  clienteId: string
  totalSesiones: number
  sesionesPresente: number
  sesionesAusente: number
  sesionesAusenteConAviso: number
  sesionesAusenteSinAviso: number
  sesionesExcluidas: number
  efectividad: number | null  // porcentaje 0–100 o null si no hay datos
  detalle: string
}

export const attendanceApi = {
  getByShiftAndDate: (shiftId: string, date: string): Promise<AttendanceRecord[]> =>
    api.get('/asistencia', { params: { turnoId: shiftId, fecha: date } })
      .then((r) => (Array.isArray(r.data) ? r.data : []).map(mapRecord)),

  bulk: (shiftId: string, date: string, presentClientIds: string[], ausentesConAviso?: string[]): Promise<void> =>
    api.post('/asistencia/bulk', {
      turnoId: shiftId,
      fecha: date,
      clientesPresentes: presentClientIds,
      ...(ausentesConAviso && ausentesConAviso.length > 0 && { ausentesConAviso }),
    }).then(() => undefined),

  getByClient: (clientId: string): Promise<AttendanceRecord[]> =>
    api.get(`/asistencia/cliente/${clientId}`)
      .then((r) => (Array.isArray(r.data) ? r.data : []).map(mapRecord)),

  verificar: (shiftId: string, date: string): Promise<VerificacionFecha> =>
    api.get('/asistencia/verificar', { params: { turnoId: shiftId, fecha: date } })
      .then((r) => r.data),

  efectividad: (clientId: string): Promise<EfectividadAsistencia> =>
    api.get(`/asistencia/efectividad/${clientId}`)
      .then((r) => r.data),

  deleteById: (id: string): Promise<void> =>
    api.delete(`/asistencia/${id}`).then(() => undefined),
}
