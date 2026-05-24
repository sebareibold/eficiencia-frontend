import { Navigate, Outlet } from 'react-router-dom'
import { usePermissions, type PermModule, type PermAction } from '../hooks/usePermissions'
import { ROUTES } from '../constants/routes'

interface Props {
  module: PermModule
  action?: PermAction
}

// Guard de ruta basado en la matriz de permisos dinámica.
// Redirige a /clients si el usuario no tiene el permiso requerido.
export default function PermissionGuard({ module, action = 'read' }: Props) {
  const { can } = usePermissions()
  return can(module, action) ? <Outlet /> : <Navigate to={ROUTES.CLIENTS} replace />
}
