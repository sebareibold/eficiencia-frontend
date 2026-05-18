import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/auth.types'
import type { PermisosMap } from '../api/permisos.api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  permissions: PermisosMap
  login: (user: User, accessToken: string, refreshToken: string, permissions?: PermisosMap) => void
  logout: () => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setPermissions: (permissions: PermisosMap) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: {},
      login: (user, accessToken, refreshToken, permissions = {}) =>
        set({ user, accessToken, refreshToken, permissions }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, permissions: {} }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setPermissions: (permissions) => set({ permissions }),
    }),
    { name: 'eficiencia-auth' },
  ),
)
