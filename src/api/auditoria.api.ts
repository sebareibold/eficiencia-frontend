import api from './axiosInstance'

export type TipoEvento =
  | 'LOGIN_EXITOSO'
  | 'LOGIN_FALLIDO'
  | 'LOGOUT'
  | 'CONTRASENA_CAMBIADA'
  | 'PERMISO_MODIFICADO'
  | 'ROL_CAMBIADO'
  | 'PAGO_ELIMINADO'

export interface EventoSeguridad {
  id: string
  tipo: TipoEvento
  usuarioId: string | null
  email: string | null
  detalle: string | null
  ip: string | null
  createdAt: string
}

export interface TopUsuario {
  usuarioId: string
  email: string | null
  total: number
  criticos: number
}

export interface ResumenSeguridad {
  eventosHoy: number
  loginFallidos24h: number
  accionesCriticas: number
  usuariosActivosHoy: number
  alertas: EventoSeguridad[]
  topUsuarios: TopUsuario[]
}

export interface EventosResponse {
  eventos: EventoSeguridad[]
  total: number
  page: number
  pageSize: number
}

export interface QueryEventosParams {
  tipo?: string
  email?: string
  desde?: string
  hasta?: string
  page?: number
  pageSize?: number
}

export const auditoriaApi = {
  getResumen(): Promise<ResumenSeguridad> {
    return api.get('/auditoria/resumen').then(r => r.data)
  },

  getEventos(params: QueryEventosParams = {}): Promise<EventosResponse> {
    return api.get('/auditoria', { params }).then(r => r.data)
  },
}
