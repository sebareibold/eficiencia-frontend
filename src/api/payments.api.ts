import api from './axiosInstance'
import type { Payment, CreatePaymentDto } from '../types/payment.types'

export interface PaginatedPayments {
  data: Payment[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaymentsSummary {
  total: number
  cantidad: number
  porMetodo: {
    EFECTIVO:      { total: number; cantidad: number }
    TRANSFERENCIA: { total: number; cantidad: number }
    DEBITO:        { total: number; cantidad: number }
    EMPRESA:       { total: number; cantidad: number }
  }
}

type BackendMetodo = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO' | 'EMPRESA'

function mapMetodoToFrontend(metodo: BackendMetodo): Payment['method'] {
  if (metodo === 'EFECTIVO') return 'cash'
  if (metodo === 'TRANSFERENCIA') return 'transfer'
  return 'card' // DEBITO, EMPRESA
}

function mapMetodoToBackend(method: Payment['method']): BackendMetodo {
  if (method === 'cash') return 'EFECTIVO'
  if (method === 'transfer') return 'TRANSFERENCIA'
  return 'DEBITO' // card
}

function mapPago(p: any): Payment {
  const clientName = p.cliente
    ? `${p.cliente.nombre} ${p.cliente.apellido}`
    : ''
  return {
    id: p.id,
    clientId: p.clienteId,
    clientName,
    amount: Number(p.monto),
    method: mapMetodoToFrontend(p.metodo),
    invoiced: p.facturado,
    paidAt: p.fecha,
    notes: p.comprobante ?? null,
    createdAt: p.createdAt,
    membresiaId: p.membresiaId ?? null,
    cuotaNumero: p.cuotaNumero ?? null,
    membresia: p.membresia
      ? {
          id: p.membresia.id,
          planNombre: p.membresia.plan?.nombre ?? '',
          planFrecuencia: p.membresia.plan?.frecuenciaSemanal ?? 0,
          estado: p.membresia.estado,
          modalidad: p.membresia.modalidad,
          precio: Number(p.membresia.precio),
          fechaInicio: p.membresia.fechaInicio,
          fechaVencimiento: p.membresia.fechaVencimiento,
        }
      : null,
  }
}

export const paymentsApi = {
  getAll: (params?: {
    month?: string; anio?: string; desde?: string; hasta?: string
    clientId?: string | number; page?: number; pageSize?: number
    method?: Payment['method']
  }): Promise<PaginatedPayments> =>
    api.get('/pagos', {
      params: {
        ...(params?.month    && { mes:       params.month }),
        ...(params?.anio     && { anio:      params.anio }),
        ...(params?.desde    && { desde:     params.desde }),
        ...(params?.hasta    && { hasta:     params.hasta }),
        ...(params?.clientId && { clienteId: params.clientId }),
        ...(params?.method   && { metodo:    mapMetodoToBackend(params.method) }),
        page:     params?.page     ?? 1,
        pageSize: params?.pageSize ?? 10,
      },
    }).then((r) => {
      const raw = r.data
      if (raw && !Array.isArray(raw) && Array.isArray(raw.data)) {
        return { ...raw, data: raw.data.map(mapPago) } as PaginatedPayments
      }
      const arr = Array.isArray(raw) ? raw : []
      return { data: arr.map(mapPago), total: arr.length, page: 1, pageSize: arr.length, totalPages: 1 }
    }),

  create: (dto: CreatePaymentDto): Promise<Payment> =>
    api.post('/pagos', {
      clienteId: dto.clientId,
      monto: dto.amount,
      metodo: mapMetodoToBackend(dto.method),
      facturado: dto.invoiced ?? false,
      fecha: dto.paidAt,
      comprobante: dto.notes,
      ...(dto.membresiaId && { membresiaId: dto.membresiaId }),
      ...(dto.cuotaNumero !== undefined && { cuotaNumero: dto.cuotaNumero }),
    }).then((r) => mapPago(r.data)),

  getById: (id: string | number): Promise<Payment> =>
    api.get(`/pagos/${id}`).then((r) => mapPago(r.data)),

  update: (id: string | number, fields: {
    amount?: number
    method?: Payment['method']
    paidAt?: string
    notes?: string | null
    membresiaId?: string | null
    invoiced?: boolean
  }): Promise<Payment> =>
    api.patch(`/pagos/${id}`, {
      ...(fields.amount    !== undefined && { monto:       fields.amount }),
      ...(fields.method    !== undefined && { metodo:      mapMetodoToBackend(fields.method) }),
      ...(fields.paidAt    !== undefined && { fecha:       fields.paidAt }),
      ...(fields.notes     !== undefined && { comprobante: fields.notes }),
      ...(fields.membresiaId !== undefined && { membresiaId: fields.membresiaId }),
      ...(fields.invoiced  !== undefined && { facturado:   fields.invoiced }),
    }).then(r => mapPago(r.data)),

  toggleInvoiced: (id: string | number, value: boolean): Promise<void> =>
    api.patch(`/pagos/${id}`, { facturado: value }),

  remove: (id: string | number) => api.delete(`/pagos/${id}`),

  getSummary: (params?: { mes?: string; desde?: string; hasta?: string; anio?: string }): Promise<PaymentsSummary> =>
    api.get('/pagos/resumen', {
      params: {
        ...(params?.mes   && { mes:   params.mes }),
        ...(params?.desde && { desde: params.desde }),
        ...(params?.hasta && { hasta: params.hasta }),
        ...(params?.anio  && { anio:  params.anio }),
      },
    }).then(r => r.data),
}
