import type { ClientStatus } from '../constants/clientStatus'

export interface Client {
  id: number
  name: string
  lastName: string
  email: string
  phone: string
  cuil: string
  status: ClientStatus
  activityStatus: 'active' | 'inactive'
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
  sede?: { id: string; nombre: string; activa: boolean } | null
  createdAt: string
  updatedAt: string
}

export interface CreateClientDto {
  name: string
  lastName: string
  email: string
  phone: string
  cuil: string
}

export interface UpdateClientDto extends Partial<CreateClientDto> {
  sedeId?: string | null
  estado?: 'ACTIVO' | 'INACTIVO'
}
