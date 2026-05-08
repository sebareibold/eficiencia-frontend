import api from './axiosInstance'
import type { LoginCredentials, LoginResponse } from '../types/auth.types'

export const authApi = {
  login: (credentials: LoginCredentials): Promise<LoginResponse> =>
    api.post('/auth/login', credentials).then((r) => {
      const { accessToken, refreshToken, usuario } = r.data
      return {
        accessToken,
        refreshToken,
        user: {
          id: usuario.id,
          name: usuario.nombre,
          lastName: '',
          email: usuario.email,
          role: (usuario.rol === 'ADMINISTRADOR' ? 'admin' : usuario.rol === 'PROFESOR' ? 'profesor' : 'staff') as 'admin' | 'staff' | 'profesor',
        },
      }
    }),

  logout: () => api.post('/auth/logout'),
}
