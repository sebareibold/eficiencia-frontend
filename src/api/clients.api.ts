import api from './axiosInstance'
import type { Client, CreateClientDto, UpdateClientDto } from '../types/client.types'
import type { FichaEntrenamiento, EventoDeportivo } from '../types/rutina.types'
import type { ClientStatus } from '../constants/clientStatus'

export interface PaginatedClients {
  data: Client[]
  total: number
  totalPages: number
}

function mapEstadoPago(estadoPago: string): ClientStatus {
  if (estadoPago === 'AL_DIA') return 'active'
  return 'expiring' // VENCIDO o EN_DEUDA (legacy)
}

function mapActividad(estado: string): 'active' | 'inactive' {
  return estado === 'INACTIVO' ? 'inactive' : 'active'
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
    cuil: c.cuil ?? '',
    status: mapEstadoPago(c.estadoPago ?? (c.estado === 'EN_DEUDA' ? 'EN_DEUDA' : c.estado === 'VENCIDO' ? 'VENCIDO' : 'AL_DIA')),
    activityStatus: mapActividad(c.estado),
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
    turnosActivosCount: c.turnosActivosCount ?? 0,
    sede: c.sede ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt ?? c.createdAt,
    proporcionalPendiente: membership?.proporcionalPendiente ?? false,
    descuentoProporcional: membership?.descuentoProporcional != null ? Number(membership.descuentoProporcional) : 0,
  }
}

function mapFicha(f: any): FichaEntrenamiento {
  return {
    id: f.id,
    peso: f.peso ?? undefined,
    altura: f.altura ?? undefined,
    actividadDiaria: f.actividadDiaria ?? undefined,
    patologiasBase: f.patologiasBase ?? undefined,
    lesiones: f.lesiones ?? undefined,
    objetivos: f.objetivos ?? undefined,
    experiencia: f.experiencia ?? undefined,
    deportePractica: f.deportePractica ?? undefined,
    eventos: (f.eventos ?? []).map((e: any) => ({
      id: e.id,
      nombre: e.nombre,
      fecha: e.fecha,
      observacion: e.observacion ?? undefined,
    })),
  }
}

export const clientsApi = {
  getAll: (params?: {
    page?: number; limit?: number; search?: string; estado?: string; estadoPago?: string;
    desde?: string; hasta?: string; sortBy?: string; sortDir?: 'asc' | 'desc'; proporcionalPendiente?: boolean;
    // filtros avanzados
    conTurnos?: boolean; frecuenciaSemanal?: '2' | '3' | 'full';
    sexo?: 'MASCULINO' | 'FEMENINO' | 'OTRO'; edadMin?: number; edadMax?: number;
    sedeId?: string; conCalendario?: boolean;
    alturaMin?: number; alturaMax?: number; pesoMin?: number; pesoMax?: number;
  }): Promise<PaginatedClients> =>
    api.get('/clientes', {
      params: {
        page:  params?.page  ?? 1,
        limit: params?.limit ?? 20,
        ...(params?.search                && { search:     params.search }),
        ...(params?.estado                && { estado: params.estado === 'active' ? 'ACTIVO' : params.estado === 'inactive' ? 'INACTIVO' : params.estado }),
        ...(params?.estadoPago            && { estadoPago: params.estadoPago }),
        ...(params?.desde                 && { desde:      params.desde }),
        ...(params?.hasta                 && { hasta:      params.hasta }),
        ...(params?.sortBy                && { sortBy:     params.sortBy }),
        ...(params?.sortDir               && { sortDir:    params.sortDir }),
        ...(params?.proporcionalPendiente !== undefined && { proporcionalPendiente: params.proporcionalPendiente }),
        // filtros avanzados
        ...(params?.conTurnos !== undefined          && { conTurnos:         params.conTurnos }),
        ...(params?.frecuenciaSemanal                && { frecuenciaSemanal: params.frecuenciaSemanal }),
        ...(params?.sexo                             && { sexo:              params.sexo }),
        ...(params?.edadMin !== undefined            && { edadMin:           params.edadMin }),
        ...(params?.edadMax !== undefined            && { edadMax:           params.edadMax }),
        ...(params?.sedeId                           && { sedeId:            params.sedeId }),
        ...(params?.conCalendario !== undefined      && { conCalendario:     params.conCalendario }),
        ...(params?.alturaMin !== undefined          && { alturaMin:         params.alturaMin }),
        ...(params?.alturaMax !== undefined          && { alturaMax:         params.alturaMax }),
        ...(params?.pesoMin !== undefined            && { pesoMin:           params.pesoMin }),
        ...(params?.pesoMax !== undefined            && { pesoMax:           params.pesoMax }),
      },
    }).then((r) => {
      const raw = r.data
      if (raw && !Array.isArray(raw) && Array.isArray(raw.data)) {
        return { data: raw.data.map(mapCliente), total: raw.total, totalPages: raw.totalPages } as PaginatedClients
      }
      const arr: any[] = Array.isArray(raw) ? raw : []
      return { data: arr.map(mapCliente), total: arr.length, totalPages: 1 }
    }),

  getById: (id: string | number): Promise<Client> =>
    api.get(`/clientes/${id}`).then((r) => mapCliente(r.data)),

  create: (dto: CreateClientDto): Promise<Client> =>
    api.post('/clientes', {
      nombre: dto.name,
      apellido: dto.lastName,
      email: dto.email || undefined,
      telefono: dto.phone || undefined,
      cuil: dto.cuil || undefined,
      fechaInicio: new Date().toISOString(),
    }).then((r) => mapCliente(r.data)),

  update: (id: string | number, dto: UpdateClientDto): Promise<Client> =>
    api.patch(`/clientes/${id}`, {
      ...(dto.name !== undefined && { nombre: dto.name }),
      ...(dto.lastName !== undefined && { apellido: dto.lastName }),
      ...(dto.email ? { email: dto.email } : {}),
      ...(dto.phone !== undefined && { telefono: dto.phone }),
      ...(dto.cuil !== undefined && { cuil: dto.cuil }),
      ...(dto.sedeId !== undefined && { sedeId: dto.sedeId || null }),
      ...(dto.estado !== undefined && { estado: dto.estado }),
    }).then((r) => mapCliente(r.data)),

  bulkUpdateEstado: (ids: string[], estado: 'ACTIVO' | 'INACTIVO'): Promise<{ updated: number }> =>
    api.patch('/clientes/bulk-estado', { ids, estado }).then((r) => r.data),

  getSedes: (): Promise<{ id: string; nombre: string; activa: boolean }[]> =>
    api.get('/clientes/sedes').then((r) => Array.isArray(r.data) ? r.data : (r.data?.data ?? [])),

  remove: (id: string | number) => api.delete(`/clientes/${id}`),

  getFichaConEventos: (id: string): Promise<FichaEntrenamiento | null> =>
    api.get(`/clientes/${id}`).then((r) => {
      const ficha = r.data?.ficha
      return ficha ? mapFicha(ficha) : null
    }),

  updateFicha: (id: string, dto: {
    peso?: number | null
    altura?: number | null
    actividadDiaria?: string | null
    objetivos?: string | null
    deportePractica?: string | null
    experiencia?: string | null
    patologiasBase?: string | null
    lesiones?: string | null
  }): Promise<FichaEntrenamiento> =>
    api.patch(`/clientes/${id}/ficha`, dto).then((r) => mapFicha(r.data)),

  createEvento: (clienteId: string, dto: { nombre: string; fecha: string; observacion?: string }): Promise<EventoDeportivo> =>
    api.post(`/clientes/${clienteId}/ficha/eventos`, dto).then((r) => ({
      id: r.data.id,
      nombre: r.data.nombre,
      fecha: r.data.fecha,
      observacion: r.data.observacion ?? undefined,
    })),

  updateEvento: (clienteId: string, eventoId: string, dto: { nombre?: string; fecha?: string; observacion?: string }): Promise<EventoDeportivo> =>
    api.patch(`/clientes/${clienteId}/ficha/eventos/${eventoId}`, dto).then((r) => ({
      id: r.data.id,
      nombre: r.data.nombre,
      fecha: r.data.fecha,
      observacion: r.data.observacion ?? undefined,
    })),

  deleteEvento: (clienteId: string, eventoId: string): Promise<void> =>
    api.delete(`/clientes/${clienteId}/ficha/eventos/${eventoId}`).then(() => undefined),
}
