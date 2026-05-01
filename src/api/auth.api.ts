import api from './axiosInstance'
import type { LoginCredentials, LoginResponse } from '../types/auth.types'

export const authApi = {
  login: (credentials: LoginCredentials) =>
    api.post<LoginResponse>('/auth/login', credentials).then((r) => r.data),

  logout: () => api.post('/auth/logout'),
}
