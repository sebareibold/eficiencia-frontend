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
