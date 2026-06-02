import { useEffect, useState, useCallback } from 'react'
import { WifiOff, RefreshCw, LogOut } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth.api'
import { useNavigate } from 'react-router-dom'

const RETRY_INTERVAL = 15
const API_URL = import.meta.env.VITE_API_URL as string

export default function ServerDownScreen() {
  const serverDown    = useUiStore(s => s.serverDown)
  const setServerDown = useUiStore(s => s.setServerDown)
  const logout        = useAuthStore(s => s.logout)
  const navigate      = useNavigate()
  const [countdown, setCountdown] = useState(RETRY_INTERVAL)
  const [checking,  setChecking]  = useState(false)

  const handleLogout = useCallback(() => {
    authApi.logout().catch(() => {})
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  const ping = useCallback(async () => {
    setChecking(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      await fetch(`${API_URL}/planes`, { signal: controller.signal })
      clearTimeout(timeout)
      setServerDown(false)
    } catch {
      // servidor aún no responde — reiniciamos el contador
      setCountdown(RETRY_INTERVAL)
    } finally {
      setChecking(false)
    }
  }, [setServerDown])

  // Countdown → auto-retry
  useEffect(() => {
    if (!serverDown) return
    if (countdown <= 0) { ping(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [serverDown, countdown, ping])

  // Reiniciar contador cada vez que se activa
  useEffect(() => {
    if (serverDown) setCountdown(RETRY_INTERVAL)
  }, [serverDown])

  if (!serverDown) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 max-w-sm w-full bg-saas-surface dark:bg-[#141414] border border-saas-border dark:border-white/[0.08] rounded-3xl p-8 shadow-saas-modal text-center">

        {/* Ícono animado */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <WifiOff className="w-8 h-8 text-red-400" />
        </div>

        <h2 className="text-lg font-bold text-saas-text dark:text-white mb-2">
          Servidor no disponible
        </h2>
        <p className="text-sm text-saas-muted dark:text-white/50 mb-6 leading-relaxed">
          No se pudo conectar con el servidor de Eficiencia.<br />
          Puede ser un reinicio temporal o un problema de red.
        </p>

        {/* Indicador de reintento */}
        <div className="flex items-center justify-center gap-2 mb-5 h-5">
          {checking ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
              <span className="text-xs text-saas-muted dark:text-white/40">Verificando conexión...</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-pulse shrink-0" />
              <span className="text-xs text-saas-muted dark:text-white/40">
                Reintentando en <span className="font-semibold tabular-nums text-saas-text dark:text-white/70">{countdown}s</span>
              </span>
            </>
          )}
        </div>

        {/* Botón manual */}
        <button
          onClick={() => { setCountdown(0) }}
          disabled={checking}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-black text-sm font-semibold mx-auto disabled:opacity-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar ahora
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 mx-auto mt-3 text-xs text-saas-muted dark:text-white/30 hover:text-saas-text dark:hover:text-white/60 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
