import type { ClientStatus } from '../constants/clientStatus'

export interface Client {
  id: number
  name: string
  lastName: string
  email: string
  phone: string
  dni: string
  status: ClientStatus
  membershipExpiresAt: string | null
  membershipStartDate?: string | null
  planName?: string | null
  planPrice?: number | null
  planFrequency?: number | null
  membershipId?: string | null
  membershipStatus?: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | null
  membershipModalidad?: 'MENSUAL' | 'TRES_MESES' | 'SEIS_MESES' | null
  membershipPrecio?: number | null
  diasUsados: number
  createdAt: string
  updatedAt: string
}

export interface CreateClientDto {
  name: string
  lastName: string
  email: string
  phone: string
  dni: string
}

export interface UpdateClientDto extends Partial<CreateClientDto> {}
