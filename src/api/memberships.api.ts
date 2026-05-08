import api from './axiosInstance'
import type { Membership, CreateMembershipDto, UpdateMembershipDto } from '../types/membership.types'

function mapPlan(p: any): Membership {
  return {
    id: p.id,
    name: p.nombre,
    price: Number(p.precioBase),
    classesPerWeek: p.frecuenciaSemanal,
    description: p.descripcion ?? undefined,
    createdAt: p.createdAt ?? '',
  }
}

export const membershipsApi = {
  getAll: (): Promise<Membership[]> =>
    api.get('/planes').then((r) => (Array.isArray(r.data) ? r.data : []).map(mapPlan)),

  create: (dto: CreateMembershipDto): Promise<Membership> =>
    api.post('/planes', {
      nombre: dto.name,
      precioBase: dto.price,
      frecuenciaSemanal: dto.classesPerWeek,
      ...(dto.description !== undefined && { descripcion: dto.description }),
    }).then((r) => mapPlan(r.data)),

  update: (id: string | number, dto: UpdateMembershipDto): Promise<Membership> =>
    api.patch(`/planes/${id}`, {
      ...(dto.name !== undefined && { nombre: dto.name }),
      ...(dto.price !== undefined && { precioBase: dto.price }),
      ...(dto.classesPerWeek !== undefined && { frecuenciaSemanal: dto.classesPerWeek }),
      ...(dto.description !== undefined && { descripcion: dto.description }),
    }).then((r) => mapPlan(r.data)),

  remove: (id: string | number) => api.delete(`/planes/${id}`),
}
