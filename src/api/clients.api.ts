import api from './axiosInstance'
import type { Client, CreateClientDto, UpdateClientDto } from '../types/client.types'
import type { ClientStatus } from '../constants/clientStatus'

function mapEstado(estado: string): ClientStatus {
  if (estado === 'ACTIVO') return 'active'
  if (estado === 'EN_DEUDA') return 'debt'
  return 'expiring' // VENCIDO
}

function mapCliente(c: any): Client {
  const membresias: any[] = c.membresias ?? []
  const membership = membresias.find(m => m.estado === 'ACTIVA') ?? membresias[0] ?? null
  const plan = membership?.plan
  return {
    id: c.id,
    name: c.nombre,
    lastName: c.apellido,
    email: c.email ?? '',
    phone: c.telefono ?? '',
    dni: c.dni ?? '',
    status: mapEstado(c.estado),
    membershipExpiresAt: membership?.fechaVencimiento ?? null,
    membershipStartDate: membership?.fechaInicio ?? null,
    planName: plan?.nombre ?? null,
    planPrice: plan?.precioBase != null ? Number(plan.precioBase) : null,
    planFrequency: plan?.frecuenciaSemanal ?? null,
    membershipId: membership?.id ?? null,
    membershipStatus: membership?.estado ?? null,
    membershipModalidad: membership?.modalidad ?? null,
    membershipPrecio: membership?.precio != null ? Number(membership.precio) : null,
    diasUsados: c.diasUsados ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt ?? c.createdAt,
  }
}

export const clientsApi = {
  getAll: (): Promise<Client[]> =>
    api.get('/clientes').then((r) => {
      // Después del unwrap global, r.data puede ser el objeto de paginación { data: [...], total }
      const items: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? [])
      return items.map(mapCliente)
    }),

  getById: (id: string | number): Promise<Client> =>
    api.get(`/clientes/${id}`).then((r) => mapCliente(r.data)),

  create: (dto: CreateClientDto): Promise<Client> =>
    api.post('/clientes', {
      nombre: dto.name,
      apellido: dto.lastName,
      email: dto.email || undefined,
      telefono: dto.phone || undefined,
      dni: dto.dni || undefined,
      fechaInicio: new Date().toISOString(),
    }).then((r) => mapCliente(r.data)),

  update: (id: string | number, dto: UpdateClientDto): Promise<Client> =>
    api.patch(`/clientes/${id}`, {
      ...(dto.name !== undefined && { nombre: dto.name }),
      ...(dto.lastName !== undefined && { apellido: dto.lastName }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.phone !== undefined && { telefono: dto.phone }),
      ...(dto.dni !== undefined && { dni: dto.dni }),
    }).then((r) => mapCliente(r.data)),

  remove: (id: string | number) => api.delete(`/clientes/${id}`),
}
