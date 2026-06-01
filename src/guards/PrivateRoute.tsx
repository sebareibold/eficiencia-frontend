import { useState, useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { ROUTES } from '../constants/routes'
import AppSkeleton from '../components/ui/AppSkeleton'

export default function PrivateRoute() {
  const { accessToken, refreshToken, setTokens, logout } = useAuthStore()

  const [isInitializing, setIsInitializing] = useState(!accessToken && !!refreshToken)

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
        .finally(() => {
          setIsInitializing(false)
        })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sin sesión y ya inicializado → login
  if (!isInitializing && !accessToken) return <Navigate to={ROUTES.LOGIN} replace />

  return (
    <>
      {/* Contenido real: monta en cuanto hay accessToken, entra con sus propias animaciones */}
      {accessToken && <Outlet />}

      {/* Skeleton como overlay fixed: se disuelve sobre el contenido que aparece debajo */}
      <AnimatePresence>
        {isInitializing && (
          <motion.div
            key="app-skeleton"
            className="fixed inset-0 z-[9999]"
            exit={{ opacity: 0, filter: 'blur(6px)', scale: 1.01 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <AppSkeleton />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
