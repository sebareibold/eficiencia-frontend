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
  | 'exercises'
  | 'plantillas'
  | 'reposiciones'
  | 'solicitudes-turno'

export type PermAction = 'read' | 'create' | 'update' | 'delete' | 'mark' | 'view_pagos' | 'view_membresias' | 'view_rutinas' | 'view_turnos' | 'view_asistencia' | 'manage_turnos'

type RolePerms = Partial<Record<PermModule, Partial<Record<PermAction, boolean>>>>

// Matriz local de permisos — usada como fallback si el servidor no responde.
// La fuente de verdad real es la tabla Permiso en la BD (permisos.service.ts).
export const MATRIX: Record<UserRole, RolePerms> = {
  admin: {
    clients:            { read: true, create: true, update: true, delete: true, view_pagos: true, view_membresias: true, view_rutinas: true, view_turnos: true, view_asistencia: true, manage_turnos: true },
    payments:           { read: true, create: true, update: true, delete: true  },
    shifts:             { read: true, create: true, update: true, delete: true  },
    attendance:         { read: true, mark: true                                 },
    expenses:           { read: true, create: true, update: true, delete: true  },
    memberships:        { read: true, create: true, update: true, delete: true  },
    dashboard:          { read: true                                             },
    users:              { read: true, create: true, update: true, delete: true  },
    rutinas:            { read: true, create: true, update: true, delete: true  },
    exercises:          { read: true, create: true, update: true, delete: true  },
    plantillas:         { read: true, create: true, update: true, delete: true  },
    reposiciones:       { read: true, create: true, update: true, delete: true  },
    'solicitudes-turno': { read: true, update: true                             },
  },
  staff: {
    clients:            { read: true, create: true, update: true, delete: false, view_pagos: true, view_membresias: true, view_rutinas: false, view_turnos: true, view_asistencia: true, manage_turnos: true },
    payments:           { read: true, create: true, update: false, delete: false },
    shifts:             { read: true, create: true, update: true, delete: true  },
    attendance:         { read: true, mark: true                                 },
    expenses:           {},
    memberships:        { read: true, create: true, update: true                },
    dashboard:          {},
    users:              {},
    rutinas:            {},
    exercises:          { read: true                                             },
    plantillas:         {},
    reposiciones:       { read: true, create: true, update: true                },
    'solicitudes-turno': { read: true, update: true                             },
  },
  profesor: {
    clients:            { view_rutinas: true },
    payments:           {},
    shifts:             { read: true                                             },
    attendance:         { read: true, mark: true                                 },
    expenses:           {},
    memberships:        {},
    dashboard:          {},
    users:              {},
    rutinas:            { read: true, create: true, update: true, delete: true  },
    exercises:          { read: true                                             },
    plantillas:         { read: true                                             },
    reposiciones:       { read: true, create: true, update: true                },
    'solicitudes-turno': { read: true, update: true                             },
  },
  cliente_comun: {
    clients:            {},
    payments:           {},
    shifts:             {},
    attendance:         {},
    expenses:           {},
    memberships:        {},
    dashboard:          {},
    users:              {},
    rutinas:            { read: true                                             },
    exercises:          {},
    plantillas:         {},
    reposiciones:       {},
    'solicitudes-turno': {},
  },
}

// ─── Labels de rol ────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:         'Administrador',
  staff:         'Staff',
  profesor:      'Profesor',
  cliente_comun: 'Socio',
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
    // ADMINISTRADOR siempre tiene acceso — igual que el bypass del backend
    if (role === 'admin') return true
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
    isAdmin:        role === 'admin',
    isStaff:        role === 'staff',
    isProfesor:     role === 'profesor',
    isClienteComun: role === 'cliente_comun',
    roleLabel:      ROLE_LABELS[role],
  }
}
