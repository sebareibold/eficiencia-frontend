export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface Shift {
  id: number
  name: string
  days: WeekDay[]
  recurrente: boolean
  fechaPuntual?: string
  startTime: string
  endTime: string
  cupoMaximoSalaA: number
  cupoMaximoSalaB: number
  inscritosA: number
  inscritosB: number
  /** cupoMaximoSalaA + cupoMaximoSalaB */
  capacity: number
  /** inscritosA + inscritosB */
  enrolled: number
  profesorSalaAId: string
  profesorSalaANombre: string
  profesorSalaAActivo: boolean
  profesorSalaAFechaBaja: string | null
  profesorSalaBId: string
  profesorSalaBNombre: string
  profesorSalaBActivo: boolean
  profesorSalaBFechaBaja: string | null
  createdAt: string
}

export interface CreateShiftDto {
  days: WeekDay[]
  recurrente: boolean
  startTime: string
  endTime: string
  cupoMaximoSalaA: number
  cupoMaximoSalaB: number
  profesorSalaAId?: string
  profesorSalaBId?: string
  clientIds?: string[]
}

export interface UpdateShiftDto extends Partial<Omit<CreateShiftDto, 'clientIds'>> {}
