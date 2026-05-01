export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface Shift {
  id: number
  name: string
  room: string
  day: WeekDay
  startTime: string
  endTime: string
  capacity: number
  enrolled: number
  createdAt: string
}

export interface CreateShiftDto {
  name: string
  room: string
  day: WeekDay
  startTime: string
  endTime: string
  capacity: number
}

export interface UpdateShiftDto extends Partial<CreateShiftDto> {}
