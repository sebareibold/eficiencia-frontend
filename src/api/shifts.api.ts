import api from './axiosInstance'
import type { Shift, CreateShiftDto, UpdateShiftDto } from '../types/shift.types'
import type { WeekDay } from '../types/shift.types'

const DIA_TO_WEEKDAY: Record<string, WeekDay> = {
  lunes: 'monday',
  martes: 'tuesday',
  'miércoles': 'wednesday',
  miercoles: 'wednesday',
  jueves: 'thursday',
  viernes: 'friday',
  'sábado': 'saturday',
  sabado: 'saturday',
  domingo: 'sunday',
}

const WEEKDAY_TO_DIA: Record<WeekDay, string> = {
  monday: 'lunes',
  tuesday: 'martes',
  wednesday: 'miércoles',
  thursday: 'jueves',
  friday: 'viernes',
  saturday: 'sábado',
  sunday: 'domingo',
}

function mapTurno(t: any): Shift {
  const diasSemana: string[] = Array.isArray(t.diasSemana) ? t.diasSemana : []
  const firstDay = diasSemana[0] ?? ''
  const day: WeekDay = DIA_TO_WEEKDAY[firstDay.toLowerCase()] ?? 'monday'
  return {
    id: t.id,
    name: `Sala ${t.sala} – ${t.horaInicio}`,
    room: t.sala,
    day,
    startTime: t.horaInicio,
    endTime: t.horaFin,
    capacity: t.cupoMaximo,
    enrolled: t.inscripcionesActivas ?? 0,
    createdAt: t.createdAt ?? '',
  }
}

export const professorsApi = {
  getAll: (): Promise<{ id: string; name: string }[]> =>
    api.get('/usuarios').then(r => {
      const users: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? [])
      return users
        .filter(u => u.profesor)
        .map(u => ({ id: String(u.profesor.id), name: String(u.nombre) }))
    }),
}

export const shiftsApi = {
  getAll: (): Promise<Shift[]> =>
    api.get('/turnos').then((r) => (Array.isArray(r.data) ? r.data : []).map(mapTurno)),

  getById: (id: string | number): Promise<Shift> =>
    api.get(`/turnos/${id}`).then((r) => mapTurno(r.data)),

  create: (dto: CreateShiftDto): Promise<Shift> =>
    api.post('/turnos', {
      sala: dto.room,
      horaInicio: dto.startTime,
      horaFin: dto.endTime,
      diasSemana: [WEEKDAY_TO_DIA[dto.day]],
      cupoMaximo: dto.capacity,
      profesorId: dto.profesorId,
    }).then((r) => mapTurno(r.data)),

  update: (id: string | number, dto: UpdateShiftDto): Promise<Shift> =>
    api.patch(`/turnos/${id}`, {
      ...(dto.room !== undefined && { sala: dto.room }),
      ...(dto.startTime !== undefined && { horaInicio: dto.startTime }),
      ...(dto.endTime !== undefined && { horaFin: dto.endTime }),
      ...(dto.day !== undefined && { diasSemana: [WEEKDAY_TO_DIA[dto.day]] }),
      ...(dto.capacity !== undefined && { cupoMaximo: dto.capacity }),
      ...(dto.profesorId !== undefined && { profesorId: dto.profesorId }),
    }).then((r) => mapTurno(r.data)),

  remove: (id: string | number) => api.delete(`/turnos/${id}`),
}
