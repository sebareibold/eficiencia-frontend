import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types/auth.types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type PermModule =
  | 'clients'
  | 'payments'
  | 'shifts'
  | 'attendance'
  | 'expenses'
  | 'memberships'
  | 'dashboard'
  | 'users'
  | 'rutinas'

export type PermAction = 'read' | 'create' | 'update' | 'delete' | 'mark'

type RolePerms = Partial<Record<PermModule, Partial<Record<PermAction, boolean>>>>

// Matriz local solo para UI (mostrar/ocultar elementos). NUNCA se usa como fallback
// de autorización — si los permisos del servidor no cargan se deniega todo.
const MATRIX: Record<UserRole, RolePerms> = {
  admin: {
    clients:     { read: true, create: true, update: true, delete: true  },
    payments:    { read: true, create: true, update: true, delete: true  },
    shifts:      { read: true, create: true, update: true, delete: true  },
    attendance:  { read: true, mark: true                                 },
    expenses:    { read: true, create: true, update: true, delete: true  },
    memberships: { read: true, create: true, update: true, delete: true  },
    dashboard:   { read: true                                             },
    users:       { read: true, create: true, update: true, delete: true  },
    rutinas:     { read: true, create: true, update: true, delete: true  },
  },
  staff: {
    clients:     { read: true, create: true, update: true, delete: false },
    payments:    { read: true, create: true, update: false, delete: false },
    shifts:      { read: true, create: true, update: true, delete: true  },
    attendance:  { read: true, mark: true                                 },
    expenses:    {},
    memberships: { read: true, create: true, update: true                },
    dashboard:   {},
    users:       {},
    rutinas:     {},
  },
  profesor: {
    clients:     { read: true                                             },
    payments:    {},
    shifts:      { read: true                                             },
    attendance:  { read: true, mark: true                                 },
    expenses:    {},
    memberships: {},
    dashboard:   {},
    users:       {},
    rutinas:     { read: true, create: true, update: true, delete: true  },
  },
}

// ─── Labels de rol ────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:    'Administrador',
  staff:    'Staff',
  profesor: 'Profesor',
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions() {
  const user        = useAuthStore(s => s.user)
  const serverPerms = useAuthStore(s => s.permissions)
  const permsLoaded = useAuthStore(s => s.permissionsLoaded)
  const role: UserRole = user?.role ?? 'staff'

  const can = (module: PermModule, action: PermAction): boolean => {
    // Deny-by-default: si los permisos del servidor no cargaron aún, denegar todo.
    // Esto previene escalada de privilegios cuando la carga de permisos falla o tarda.
    if (!permsLoaded) return false
    return serverPerms[module]?.[action] ?? false
  }

  // Solo para hints de UI (Navbar, botones): usa la MATRIX si no hay server perms.
  // No usar para guards de ruta — usar can() en su lugar.
  const canUI = (module: PermModule, action: PermAction): boolean => {
    if (permsLoaded && Object.keys(serverPerms).length > 0) {
      return serverPerms[module]?.[action] ?? false
    }
    return MATRIX[role]?.[module]?.[action] ?? false
  }

  return {
    can,
    canUI,
    role,
    permsLoaded,
    isAdmin:    role === 'admin',
    isStaff:    role === 'staff',
    isProfesor: role === 'profesor',
    roleLabel:  ROLE_LABELS[role],
  }
}
