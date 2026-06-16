import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'

export default function PrivateRoute() {
  const { accessToken, user, setTokens, logout } = useAuthStore()
  // Mientras se recupera el accessToken tras F5 no renderizamos nada para evitar
  // que los componentes hijos hagan llamadas API sin token (race condition con /auth/refresh).
  const [recovering, setRecovering] = useState(!accessToken && !!user)

  useEffect(() => {
    // F5 recovery: hay usuario persistido pero el accessToken se perdió (no persiste en memoria).
    // La cookie HttpOnly del refreshToken se envía automáticamente — no hay que leerla del store.
    if (!accessToken && user) {
      axios
        .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, {}, { withCredentials: true })
        .then(({ data }) => {
          const tokens = data?.data ?? data
          setTokens(tokens.accessToken)
        })
        .catch(() => {
          logout()
        })
        .finally(() => setRecovering(false))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sin usuario persistido → sesión nunca iniciada o logout explícito
  if (!accessToken && !user) return <Navigate to={ROUTES.LOGIN} replace />

  // Esperar a que el refresh complete antes de montar los hijos
  if (recovering) return null

  return <Outlet />
}
