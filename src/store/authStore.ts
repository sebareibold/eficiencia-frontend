import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types/auth.types'
import type { PermisosMap } from '../types/permisos.types'

interface AuthState {
  user: User | null
  accessToken: string | null      // En memoria — NO persistido (seguridad)
  // refreshToken eliminado — ahora vive en cookie HttpOnly (SEC-F01)
  permissions: PermisosMap
  permissionsLoaded: boolean      // true solo cuando el servidor respondió OK
  login: (user: User, accessToken: string, permissions?: PermisosMap) => void
  logout: () => void
  setTokens: (accessToken: string) => void
  setPermissions: (permissions: PermisosMap) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      permissions: {},
      permissionsLoaded: false,
      login: (user, accessToken, permissions = {}) =>
        set({ user, accessToken, permissions, permissionsLoaded: Object.keys(permissions).length > 0 }),
      logout: () => set({ user: null, accessToken: null, permissions: {}, permissionsLoaded: false }),
      setTokens: (accessToken) => set({ accessToken }),
      setPermissions: (permissions) => set({ permissions, permissionsLoaded: true }),
    }),
    {
      name: 'eficiencia-auth',
      // Excluir accessToken del almacenamiento persistente.
      // Un accessToken solo dura 15 min — no vale la pena persistirlo y es un
      // vector de ataque si alguien accede al localStorage entre sesiones.
      // refreshToken ya no está aquí — vive en cookie HttpOnly.
      partialize: (state) => ({
        user: state.user,
        // accessToken NO se persiste (seguridad — dura 15 min)
        // permissions SÍ se persisten para evitar skeleton de guard en cada navegación.
        // Layout refresca los permisos reales en mount y en window focus.
        permissions: state.permissions,
        permissionsLoaded: state.permissionsLoaded,
      }),
    },
  ),
)
