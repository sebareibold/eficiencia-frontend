import api from './axiosInstance'
import type { Payment, CreatePaymentDto } from '../types/payment.types'

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
  }
}

export const paymentsApi = {
  getAll: (params?: { month?: string; anio?: string; desde?: string; hasta?: string; clientId?: string | number }): Promise<Payment[]> =>
    api.get('/pagos', {
      params: {
        ...(params?.month && { mes: params.month }),
        ...(params?.anio && { anio: params.anio }),
        ...(params?.desde && { desde: params.desde }),
        ...(params?.hasta && { hasta: params.hasta }),
        ...(params?.clientId && { clienteId: params.clientId }),
      },
    }).then((r) => (Array.isArray(r.data) ? r.data : []).map(mapPago)),

  create: (dto: CreatePaymentDto): Promise<Payment> =>
    api.post('/pagos', {
      clienteId: dto.clientId,
      monto: dto.amount,
      metodo: mapMetodoToBackend(dto.method),
      facturado: dto.invoiced ?? false,
      fecha: dto.paidAt,
      comprobante: dto.notes,
    }).then((r) => mapPago(r.data)),

  toggleInvoiced: (id: string | number): Promise<Payment> =>
    api.patch(`/pagos/${id}`, { facturado: true }).then((r) => mapPago(r.data)),

  remove: (id: string | number) => api.delete(`/pagos/${id}`),
}
