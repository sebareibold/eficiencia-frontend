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
  const days: WeekDay[] = diasSemana
    .map(d => DIA_TO_WEEKDAY[d.toLowerCase()])
    .filter((d): d is WeekDay => !!d)

  const cupoMaximoSalaA: number = t.cupoMaximoSalaA ?? 0
  const cupoMaximoSalaB: number = t.cupoMaximoSalaB ?? 0
  const inscritosA: number = t.inscritosA ?? 0
  const inscritosB: number = t.inscritosB ?? 0

  return {
    id: t.id,
    name: `${t.horaInicio} – ${t.horaFin}`,
    days: days.length > 0 ? days : ['monday'],
    recurrente: t.recurrente ?? true,
    startTime: t.horaInicio,
    endTime: t.horaFin,
    cupoMaximoSalaA,
    cupoMaximoSalaB,
    inscritosA,
    inscritosB,
    capacity: cupoMaximoSalaA + cupoMaximoSalaB,
    enrolled: inscritosA + inscritosB,
    profesorId: String(t.profesorId ?? ''),
    profesorNombre: t.profesor?.usuario?.nombre ?? t.profesor?.nombre ?? '',
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
  getAll: (fecha?: string): Promise<Shift[]> =>
    api.get('/turnos', fecha ? { params: { fecha } } : undefined)
      .then((r) => (Array.isArray(r.data) ? r.data : []).map(mapTurno)),

  getById: (id: string | number): Promise<Shift> =>
    api.get(`/turnos/${id}`).then((r) => mapTurno(r.data)),

  create: (dto: CreateShiftDto): Promise<Shift> =>
    api.post('/turnos', {
      horaInicio: dto.startTime,
      horaFin: dto.endTime,
      diasSemana: dto.days.map(d => WEEKDAY_TO_DIA[d]),
      recurrente: dto.recurrente,
      cupoMaximoSalaA: dto.cupoMaximoSalaA,
      cupoMaximoSalaB: dto.cupoMaximoSalaB,
      profesorId: dto.profesorId,
    }).then((r) => mapTurno(r.data)),

  update: (id: string | number, dto: UpdateShiftDto): Promise<Shift> =>
    api.patch(`/turnos/${id}`, {
      ...(dto.startTime !== undefined && { horaInicio: dto.startTime }),
      ...(dto.endTime !== undefined && { horaFin: dto.endTime }),
      ...(dto.days !== undefined && { diasSemana: dto.days.map(d => WEEKDAY_TO_DIA[d]) }),
      ...(dto.recurrente !== undefined && { recurrente: dto.recurrente }),
      ...(dto.cupoMaximoSalaA !== undefined && { cupoMaximoSalaA: dto.cupoMaximoSalaA }),
      ...(dto.cupoMaximoSalaB !== undefined && { cupoMaximoSalaB: dto.cupoMaximoSalaB }),
      ...(dto.profesorId !== undefined && { profesorId: dto.profesorId }),
    }).then((r) => mapTurno(r.data)),

  remove: (id: string | number) => api.delete(`/turnos/${id}`),
}
