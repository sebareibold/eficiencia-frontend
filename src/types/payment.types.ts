export type PaymentMethod = 'cash' | 'transfer' | 'card'

export interface Payment {
  id: number
  clientId: number
  clientName: string
  amount: number
  method: PaymentMethod
  invoiced: boolean
  paidAt: string
  notes: string | null
  createdAt: string
  membresiaId: string | null
  cuotaNumero: number | null
  membresia?: {
    id: string
    planNombre: string
    planFrecuencia: number
    estado: string
    modalidad: string
    precio: number
    fechaInicio: string
    fechaVencimiento: string
  } | null
}

export interface CreatePaymentDto {
  clientId: number
  amount: number
  method: PaymentMethod
  invoiced?: boolean
  paidAt: string
  notes?: string
  membresiaId?: string
  cuotaNumero?: number
}
