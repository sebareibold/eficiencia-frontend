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
  turnosActivosCount: number
  sede?: { id: string; nombre: string; activa: boolean } | null
  createdAt: string
  updatedAt: string
  proporcionalPendiente?: boolean
  descuentoProporcional?: number
  fechaNacimiento?: string | null
  esMenor?: boolean
  exentoDePago?: boolean
  motivoExencion?: string | null
  responsableNombre?: string | null
  responsableCuil?: string | null
  responsableContacto?: string | null
}

export interface CreateClientDto {
  name: string
  lastName: string
  email: string
  phone: string
  cuil: string
  fechaNacimiento?: string
  exentoDePago?: boolean
  motivoExencion?: string
  responsableNombre?: string
  responsableCuil?: string
  responsableContacto?: string
}

export interface UpdateClientDto extends Partial<CreateClientDto> {
  sedeId?: string | null
  estado?: 'ACTIVO' | 'INACTIVO'
  fechaNacimiento?: string | null
  exentoDePago?: boolean
  motivoExencion?: string | null
  responsableNombre?: string | null
  responsableCuil?: string | null
  responsableContacto?: string | null
}
