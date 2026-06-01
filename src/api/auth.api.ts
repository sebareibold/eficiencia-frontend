import axios from 'axios'
import api from './axiosInstance'
import { useAuthStore } from '../store/authStore'
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
    const { accessToken, refreshToken, usuario } = r.data

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

    return { accessToken, refreshToken, user, permissions, serverConfig }
  },

  logout: () => {
    const { refreshToken } = useAuthStore.getState()
    return api.post('/auth/logout', refreshToken ? { refreshToken } : {})
  },
}
