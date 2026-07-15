import api from './axiosInstance'

export type UserRole = 'ADMINISTRADOR' | 'STAFF' | 'PROFESOR' | 'CLIENTE_COMUN'

export interface AppUser {
  id: string
  nombre: string
  email: string
  rol: UserRole
  activo: boolean
  createdAt: string
  profesor: { id: string; especialidad: string | null; activo: boolean; fechaBaja: string | null } | null
}

export interface TurnoResumen {
  id: string
  horaInicio: string
  horaFin: string
  diasSemana: string[]
  recurrente: boolean
}

export interface ProfesorDetalle {
  id: string
  nombre: string
  email: string
  rol: UserRole
  activo: boolean
  createdAt: string
  profesor: {
    id: string
    especialidad: string | null
    activo: boolean
    fechaBaja: string | null
    turnosSalaA: TurnoResumen[]
    turnosSalaB: TurnoResumen[]
  } | null
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

  getById: (id: string): Promise<AppUser> =>
    api.get(`/usuarios/${id}`).then(r => r.data),

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

  getProfesorDetalle: (usuarioId: string): Promise<ProfesorDetalle> =>
    api.get(`/usuarios/profesores/${usuarioId}`).then(r => r.data),

  bajaProfesor: (usuarioId: string): Promise<{ turnosDespejados: number }> =>
    api.patch(`/usuarios/profesores/${usuarioId}/baja`).then(r => r.data),

  reactivarProfesor: (usuarioId: string): Promise<AppUser> =>
    api.patch(`/usuarios/profesores/${usuarioId}/reactivar`).then(r => r.data),
}
