import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/auth.types'
import type { PermisosMap } from '../api/permisos.api'

interface AuthState {
  user: User | null
  accessToken: string | null      // En memoria — NO persistido (seguridad)
  refreshToken: string | null     // Persistido para sobrevivir recargas
  permissions: PermisosMap
  permissionsLoaded: boolean      // true solo cuando el servidor respondió OK
  login: (user: User, accessToken: string, refreshToken: string, permissions?: PermisosMap) => void
  logout: () => void
  setTokens: (accessToken: string, refreshToken?: string) => void
  setPermissions: (permissions: PermisosMap) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      permissions: {},
      permissionsLoaded: false,
      login: (user, accessToken, refreshToken, permissions = {}) =>
        set({ user, accessToken, refreshToken, permissions, permissionsLoaded: Object.keys(permissions).length > 0 }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, permissions: {}, permissionsLoaded: false }),
      setTokens: (accessToken, refreshToken) =>
        set((s) => ({ accessToken, refreshToken: refreshToken ?? s.refreshToken })),
      setPermissions: (permissions) => set({ permissions, permissionsLoaded: true }),
    }),
    {
      name: 'eficiencia-auth',
      // Excluir accessToken del almacenamiento persistente.
      // Un accessToken solo dura 15 min — no vale la pena persistirlo y es un
      // vector de ataque si alguien accede al localStorage entre sesiones.
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        // accessToken NO se persiste (seguridad — dura 15 min)
        // permissions SÍ se persisten para evitar skeleton de guard en cada navegación.
        // Layout refresca los permisos reales en mount y en window focus.
        permissions: state.permissions,
        permissionsLoaded: state.permissionsLoaded,
      }),
    },
  ),
)
