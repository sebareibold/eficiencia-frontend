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
  }
}

export const attendanceApi = {
  getByShiftAndDate: (shiftId: string, date: string): Promise<AttendanceRecord[]> =>
    api.get('/asistencia', { params: { turnoId: shiftId, fecha: date } })
      .then((r) => (Array.isArray(r.data) ? r.data : []).map(mapRecord)),

  bulk: (shiftId: string, date: string, presentClientIds: string[]): Promise<void> =>
    api.post('/asistencia/bulk', {
      turnoId: shiftId,
      fecha: date,
      clientesPresentes: presentClientIds,
    }).then(() => undefined),

  getByClient: (clientId: string): Promise<AttendanceRecord[]> =>
    api.get(`/asistencia/cliente/${clientId}`)
      .then((r) => (Array.isArray(r.data) ? r.data : []).map(mapRecord)),
}
