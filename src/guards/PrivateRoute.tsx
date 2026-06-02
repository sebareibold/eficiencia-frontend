import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'

export default function PrivateRoute() {
  const { accessToken, refreshToken, setTokens, logout } = useAuthStore()

  useEffect(() => {
    if (!accessToken && refreshToken) {
      axios
        .post(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refreshToken })
        .then(({ data }) => {
          const tokens = data?.data ?? data
          setTokens(tokens.accessToken, tokens.refreshToken ?? refreshToken)
        })
        .catch(() => {
          logout()
        })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!accessToken && !refreshToken) return <Navigate to={ROUTES.LOGIN} replace />

  return <Outlet />
}
