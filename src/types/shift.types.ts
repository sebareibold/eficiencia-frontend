export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface Shift {
  id: number
  name: string
  room: string
  days: WeekDay[]       // todos los días en que se dicta (soporte multi-día)
  recurrente: boolean   // true = recurrente semanal, false = evento puntual
  startTime: string
  endTime: string
  capacity: number
  enrolled: number
  profesorId: string    // UUID del Profesor (para pre-rellenar el select de edición)
  profesorNombre: string
  createdAt: string
}

export interface CreateShiftDto {
  room: string
  days: WeekDay[]
  recurrente: boolean
  startTime: string
  endTime: string
  capacity: number
  profesorId?: string
  clientIds?: string[]
}

export interface UpdateShiftDto extends Partial<CreateShiftDto> {}
