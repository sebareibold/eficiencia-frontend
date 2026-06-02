import { Navigate, Outlet } from 'react-router-dom'
import { usePermissions, type PermModule, type PermAction } from '../hooks/usePermissions'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'

interface Props {
  module: PermModule
  action?: PermAction
}

// Destino de redirección según rol cuando no hay permiso para la ruta solicitada.
function homeForRole(role: string | undefined): string {
  switch (role) {
    case 'admin':         return ROUTES.DASHBOARD
    case 'profesor':      return ROUTES.SHIFTS
    case 'cliente_comun': return ROUTES.EJECUCION
    default:              return ROUTES.CLIENTS   // staff
  }
}

export default function PermissionGuard({ module, action = 'read' }: Props) {
  const { can, permsLoaded } = usePermissions()
  const user = useAuthStore((s) => s.user)

  if (!permsLoaded) return null

  if (can(module, action)) return <Outlet />

  return <Navigate to={homeForRole(user?.role)} replace />
}
