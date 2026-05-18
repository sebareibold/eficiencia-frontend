import api from './axiosInstance'

export type PermisosMap = Record<string, Record<string, boolean>>

export interface PermisoEntry {
  id: string
  rol: string
  modulo: string
  accion: string
  permitido: boolean
}

export const permisosApi = {
  // Devuelve los permisos del usuario autenticado como { modulo: { accion: boolean } }
  getForMyRole: (): Promise<PermisosMap> =>
    api.get('/permisos/mi-rol').then(r => r.data),

  // Lista plana de permisos (admin only)
  getAll: (rol?: string): Promise<PermisoEntry[]> =>
    api.get('/permisos', { params: rol ? { rol } : undefined }).then(r =>
      Array.isArray(r.data) ? r.data : []
    ),

  update: (id: string, permitido: boolean): Promise<PermisoEntry> =>
    api.patch(`/permisos/${id}`, { permitido }).then(r => r.data),
}
