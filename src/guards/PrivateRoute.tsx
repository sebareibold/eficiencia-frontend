import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'

export default function PrivateRoute() {
  const { accessToken, user, setTokens, logout } = useAuthStore()

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
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sin usuario persistido → sesión nunca iniciada o logout explícito
  if (!accessToken && !user) return <Navigate to={ROUTES.LOGIN} replace />

  return <Outlet />
}
