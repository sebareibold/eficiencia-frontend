export interface Membership {
  id: number
  name: string
  price: number
  classesPerWeek: number
  description?: string
  createdAt: string
}

export interface CreateMembershipDto {
  name: string
  price: number
  classesPerWeek: number
  description?: string
}

export interface UpdateMembershipDto extends Partial<CreateMembershipDto> {}
