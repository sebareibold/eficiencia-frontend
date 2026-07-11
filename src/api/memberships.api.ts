// Gestión de Planes (/planes) — CRUD de los planes del gimnasio
import api from './axiosInstance'
import type { Plan, CreatePlanDto, UpdatePlanDto, TarifaVigente, Modalidad } from '../types/membership.types'

function mapTarifa(t: any): TarifaVigente {
  return {
    id: t.id,
    planId: t.planId,
    modalidad: t.modalidad as Modalidad,
    metodoPago: t.metodoPago ?? 'TRANSFERENCIA',
    precio: Number(t.precio),
    vigenteDesde: t.vigenteDesde,
  }
}

function mapPlan(p: any): Plan {
  return {
    id: p.id,
    name: p.nombre,
    classesPerWeek: p.frecuenciaSemanal,
    description: p.descripcion ?? undefined,
    tarifas: Array.isArray(p.tarifas) ? p.tarifas.map(mapTarifa) : [],
    membresiaCount: p._count?.membresias ?? 0,
  }
}

export const membershipsApi = {
  getAll: (): Promise<Plan[]> =>
    api.get('/planes').then((r) => (Array.isArray(r.data) ? r.data : []).map(mapPlan)),

  getById: (id: string): Promise<Plan> =>
    api.get(`/planes/${id}`).then((r) => mapPlan(r.data)),

  create: (dto: CreatePlanDto): Promise<Plan> =>
    api.post('/planes', {
      nombre: dto.name,
      frecuenciaSemanal: dto.classesPerWeek,
      ...(dto.description !== undefined && { descripcion: dto.description }),
    }).then((r) => mapPlan(r.data)),

  update: (id: string | number, dto: UpdatePlanDto): Promise<Plan> =>
    api.patch(`/planes/${id}`, {
      ...(dto.name !== undefined && { nombre: dto.name }),
      ...(dto.classesPerWeek !== undefined && { frecuenciaSemanal: dto.classesPerWeek }),
      ...(dto.description !== undefined && { descripcion: dto.description }),
    }).then((r) => mapPlan(r.data)),

  remove: (id: string | number) => api.delete(`/planes/${id}`),
}
