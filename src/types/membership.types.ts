export type Modalidad =
  | 'TRANSFERENCIA_MENSUAL'
  | 'EFECTIVO'
  | 'MEMBRESIA_3_MESES'
  | 'MEMBRESIA_6_MESES'

export const MODALIDAD_LABELS: Record<Modalidad, string> = {
  TRANSFERENCIA_MENSUAL: 'Transferencia / débito mensual',
  EFECTIVO: 'Efectivo',
  MEMBRESIA_3_MESES: 'Membresía 3 meses',
  MEMBRESIA_6_MESES: 'Membresía 6 meses',
}

export const MODALIDAD_DURACION: Record<Modalidad, string> = {
  TRANSFERENCIA_MENSUAL: '30 días',
  EFECTIVO: '30 días',
  MEMBRESIA_3_MESES: '90 días',
  MEMBRESIA_6_MESES: '180 días',
}

export const MODALIDADES: Modalidad[] = [
  'TRANSFERENCIA_MENSUAL',
  'EFECTIVO',
  'MEMBRESIA_3_MESES',
  'MEMBRESIA_6_MESES',
]

export interface TarifaVigente {
  id: string
  planId: string
  modalidad: Modalidad
  precio: number
  vigenteDesde: string
}

export interface Plan {
  id: string
  name: string
  classesPerWeek: number
  description?: string
  tarifas: TarifaVigente[]
  membresiaCount?: number
}

// Alias de compatibilidad (PaymentsPage y MembershipsPage usan Membership)
export type Membership = Plan

export interface CreatePlanDto {
  name: string
  classesPerWeek: number
  description?: string
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {}

// Para crear/asignar una membresía a un cliente
export interface CreateMembresiaClienteDto {
  clienteId: string
  planId: string
  modalidad: Modalidad
  precio?: number       // opcional: si se omite, el backend lo toma de TarifaVigente
  fechaInicio?: string  // ISO date, default: hoy
}

export interface MembresiaCliente {
  id: string
  clienteId: string
  planId: string
  modalidad: Modalidad
  precio: number
  fechaInicio: string
  fechaVencimiento: string
  estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA'
  plan: { nombre: string; frecuenciaSemanal: number }
}
