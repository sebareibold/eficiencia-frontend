import { useEffect, useRef, useCallback } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Navbar from './Navbar'
import ToastContainer from '../ui/Toast'
import { permisosApi } from '../../api/permisos.api'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth.api'

const SESSION_TIMEOUT_MS  = 30 * 60 * 1000  // 30 minutos de inactividad
const PERMS_INTERVAL_MS   =  5 * 60 * 1000  // refrescar permisos cada 5 minutos

export default function Layout() {
  const setPermissions = useAuthStore(s => s.setPermissions)
  const accessToken    = useAuthStore(s => s.accessToken)
  const logout         = useAuthStore(s => s.logout)
  const navigate       = useNavigate()

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Logout con invalidación en servidor ────────────────────────────────────
  const doLogout = useCallback(async () => {
    try { await authApi.logout() } catch { /* ignorar errores de red al cerrar */ }
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  // ── Timeout de inactividad — 30 min ────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return

    const resetTimer = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      inactivityTimer.current = setTimeout(doLogout, SESSION_TIMEOUT_MS)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [accessToken, doLogout])

  // ── Carga y refresco de permisos ────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return

    const refresh = () => {
      permisosApi.getForMyRole()
        .then(perms => {
          if (Object.keys(perms).length > 0) setPermissions(perms)
        })
        .catch(() => {
          // No actualizar — los permisos previos (o estado deny-by-default) se mantienen
        })
    }

    refresh()

    // Refrescar al recuperar foco (el admin cambió permisos en otra pestaña)
    window.addEventListener('focus', refresh)

    // Refrescar cada 5 minutos para detectar cambios de rol en sesiones largas
    const interval = setInterval(refresh, PERMS_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', refresh)
      clearInterval(interval)
    }
  }, [accessToken, setPermissions])

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-[#fafafa] dark:bg-[#050505] transition-colors duration-300">

      {/* 1. Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>

      {/* 2. Glassmorphic Glowing Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top Left — primary accent glow */}
        <div
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[140px] mix-blend-multiply dark:mix-blend-screen animate-pulse"
          style={{
            animationDuration: '10s',
            background: 'radial-gradient(ellipse at center, rgb(var(--color-primary) / 0.45) 0%, transparent 70%)',
          }}
        />
        {/* Bottom Right — secondary accent glow */}
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[160px] mix-blend-multiply dark:mix-blend-screen"
          style={{
            background: 'radial-gradient(ellipse at center, rgb(var(--color-primary) / 0.2) 0%, transparent 70%)',
          }}
        />
        {/* Center — subtle warmth (light mode only) */}
        <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-gradient-to-t from-white/60 to-transparent dark:hidden blur-[100px]" />
      </div>

      {/* 2b. Vignette — focuses attention toward center */}
      <div className="absolute inset-0 pointer-events-none z-[1]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.07) 100%)' }}
      ></div>

      {/* 3. Premium Grain/Noise Overlay */}
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.4] dark:opacity-[0.25] mix-blend-overlay">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>

      <Navbar />
      <main className="flex-1 px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6 lg:px-12 lg:py-7 xl:px-16 xl:py-8 overflow-auto text-gray-800 dark:text-gray-100 relative z-10 w-full max-w-[1600px] mx-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
