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

export type PermAction = 'read' | 'create' | 'update' | 'delete' | 'mark'

type RolePerms = Partial<Record<PermModule, Partial<Record<PermAction, boolean>>>>

// ─── Matriz de permisos ───────────────────────────────────────────────────────
//
//  admin    → acceso total
//  staff    → clientes (sin eliminar), pagos (sin editar), turnos (solo ver), asistencia
//  profesor → clientes (solo ver), turnos (solo ver), asistencia

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
  },
  staff: {
    clients:     { read: true, create: true, update: true, delete: false },
    payments:    { read: true, create: true, update: false, delete: false },
    shifts:      { read: true, create: false, update: false, delete: false },
    attendance:  { read: true, mark: true                                  },
    expenses:    {},
    memberships: {},
    dashboard:   {},
    users:       {},
  },
  profesor: {
    clients:     { read: true                                              },
    payments:    {},
    shifts:      { read: true                                              },
    attendance:  { read: true, mark: true                                  },
    expenses:    {},
    memberships: {},
    dashboard:   {},
    users:       {},
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
  const user = useAuthStore(s => s.user)
  const role: UserRole = user?.role ?? 'staff'

  const can = (module: PermModule, action: PermAction): boolean =>
    MATRIX[role]?.[module]?.[action] ?? false

  return {
    can,
    role,
    isAdmin:   role === 'admin',
    isStaff:   role === 'staff',
    isProfesor: role === 'profesor',
    roleLabel: ROLE_LABELS[role],
  }
}
