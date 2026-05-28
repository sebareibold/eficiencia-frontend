import { Navigate, Outlet } from 'react-router-dom'
import { usePermissions, type PermModule, type PermAction } from '../hooks/usePermissions'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'

interface Props {
  module: PermModule
  action?: PermAction
}

// Guard de ruta basado en la matriz de permisos dinámica.
// cliente_comun se redirige a /ejecucion; otros roles sin permiso van a /clients.
export default function PermissionGuard({ module, action = 'read' }: Props) {
  const { can } = usePermissions()
  const user = useAuthStore((s) => s.user)

  if (can(module, action)) return <Outlet />

  return (
    <Navigate
      to={user?.role === 'cliente_comun' ? ROUTES.EJECUCION : ROUTES.CLIENTS}
      replace
    />
  )
}
