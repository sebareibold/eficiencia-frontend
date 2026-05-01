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
}

export interface CreatePaymentDto {
  clientId: number
  amount: number
  method: PaymentMethod
  invoiced?: boolean
  paidAt: string
  notes?: string
}
