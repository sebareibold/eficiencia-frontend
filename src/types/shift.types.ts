export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface Shift {
  id: number
  name: string
  days: WeekDay[]
  recurrente: boolean
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
  profesorId: string
  profesorNombre: string
  createdAt: string
}

export interface CreateShiftDto {
  days: WeekDay[]
  recurrente: boolean
  startTime: string
  endTime: string
  cupoMaximoSalaA: number
  cupoMaximoSalaB: number
  profesorId?: string
  clientIds?: string[]
}

export interface UpdateShiftDto extends Partial<Omit<CreateShiftDto, 'clientIds'>> {}
