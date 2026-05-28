export type UserRole = 'admin' | 'staff' | 'profesor' | 'cliente_comun'

export interface User {
  id: number
  name: string
  lastName: string
  email: string
  role: UserRole
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  accessToken: string
  refreshToken: string
}
