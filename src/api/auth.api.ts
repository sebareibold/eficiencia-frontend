import axios from 'axios'
import api from './axiosInstance'
import type { LoginCredentials, LoginResponse } from '../types/auth.types'
import type { PermisosMap } from './permisos.api'
import type { ConfiguracionData } from './configuracion.api'

export interface ExtendedLoginResponse extends LoginResponse {
  permissions: PermisosMap
  serverConfig: Partial<ConfiguracionData>
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<ExtendedLoginResponse> => {
    const r = await api.post('/auth/login', credentials)
    // refreshToken ya NO viene en el body — el server lo setea como cookie HttpOnly
    const { accessToken, usuario } = r.data

    const user: LoginResponse['user'] = {
      id: usuario.id,
      name: usuario.nombre,
      lastName: '',
      email: usuario.email,
      role: (
        usuario.rol === 'ADMINISTRADOR' ? 'admin'
        : usuario.rol === 'PROFESOR'    ? 'profesor'
        : usuario.rol === 'CLIENTE_COMUN' ? 'cliente_comun'
        :                                   'staff'
      ) as 'admin' | 'staff' | 'profesor' | 'cliente_comun',
    }

    // Cargar permisos y configuración usando el token recién obtenido
    const baseURL = import.meta.env.VITE_API_URL
    const headers = { Authorization: `Bearer ${accessToken}` }

    const [permissions, serverConfig] = await Promise.all([
      axios.get<{ data: PermisosMap } | PermisosMap>(`${baseURL}/permisos/mi-rol`, { headers })
        .then(res => {
          const d = res.data as any
          return (d?.data && typeof d.data === 'object') ? d.data : d
        })
        .catch(() => ({} as PermisosMap)),
      axios.get<{ data: ConfiguracionData } | ConfiguracionData>(`${baseURL}/configuracion`, { headers })
        .then(res => {
          const d = res.data as any
          return (d?.data && typeof d.data === 'object') ? d.data : d
        })
        .catch(() => ({} as Partial<ConfiguracionData>)),
    ])

    return { accessToken, user, permissions, serverConfig }
  },

  // refreshToken ya no se envía en el body — la cookie se envía automáticamente
  logout: () => api.post('/auth/logout', {}),

  changePassword: (data: { passwordActual: string; passwordNueva: string }) =>
    api.patch('/auth/change-password', data),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, nuevaPassword: string) =>
    api.post('/auth/reset-password', { token, nuevaPassword }),

  getResetRequests: (): Promise<{ id: string; usuario: { nombre: string; email: string }; createdAt: string; estado: string }[]> =>
    api.get('/auth/reset-requests').then(r => r.data),

  aprobarReset: (id: string) =>
    api.patch(`/auth/reset-requests/${id}/aprobar`),

  rechazarReset: (id: string) =>
    api.patch(`/auth/reset-requests/${id}/rechazar`),
}
