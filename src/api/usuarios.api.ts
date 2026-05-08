import api from './axiosInstance'

export type UserRole = 'ADMINISTRADOR' | 'STAFF' | 'PROFESOR'

export interface AppUser {
  id: string
  nombre: string
  email: string
  rol: UserRole
  activo: boolean
  createdAt: string
  profesor: { id: string; especialidad: string | null } | null
}

export interface CreateUserDto {
  nombre: string
  email: string
  password: string
  rol?: UserRole
  activo?: boolean
}

export interface UpdateUserDto {
  nombre?: string
  email?: string
  password?: string
  rol?: UserRole
  activo?: boolean
}

function toArray(data: unknown): AppUser[] {
  if (Array.isArray(data)) return data as AppUser[]
  if (data && typeof data === 'object' && 'data' in data) return (data as any).data ?? []
  return []
}

export const usuariosApi = {
  getAll: (): Promise<AppUser[]> =>
    api.get('/usuarios').then(r => toArray(r.data)),

  create: (dto: CreateUserDto): Promise<AppUser> =>
    api.post('/usuarios', dto).then(r => r.data),

  update: (id: string, dto: UpdateUserDto): Promise<AppUser> =>
    api.patch(`/usuarios/${id}`, dto).then(r => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`/usuarios/${id}`).then(() => undefined),

  linkProfesor: (userId: string, especialidad?: string): Promise<AppUser> =>
    api.post(`/usuarios/${userId}/profesor`, { especialidad }).then(r => r.data),

  updateProfesor: (userId: string, especialidad: string): Promise<AppUser> =>
    api.patch(`/usuarios/${userId}/profesor`, { especialidad }).then(r => r.data),

  unlinkProfesor: (userId: string): Promise<AppUser> =>
    api.delete(`/usuarios/${userId}/profesor`).then(r => r.data),
}
