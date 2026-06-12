import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Sun, Moon, Clock } from 'lucide-react'

import Navbar from './Navbar'
import ToastContainer from '../ui/Toast'
import ServerDownScreen from '../ui/ServerDownScreen'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { permisosApi } from '../../api/permisos.api'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api/auth.api'
import { MATRIX } from '../../hooks/usePermissions'
import { useSettingsStore } from '../../store/settingsStore'

function KioskHeader({ onLogout }: { onLogout: () => void }) {
  const theme            = useSettingsStore(s => s.appearance.theme)
  const updateAppearance = useSettingsStore(s => s.updateAppearance)
  const toggleTheme      = () => updateAppearance({ theme: theme === 'dark' ? 'light' : 'dark' })

  return (
    <header className="relative z-20 flex items-center justify-center pt-6 pb-0">
      <img src="/logo.png" alt="Eficiencia" className="h-24 w-24 rounded-3xl object-contain" />
      <div className="absolute right-4 top-6 flex items-center gap-2">
        <div className="rounded-xl bg-white/30 dark:bg-white/[0.05] backdrop-blur-3xl border border-white/50 dark:border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <button
            onClick={toggleTheme}
            className="p-2.5 text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors"
            title="Cambiar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
        <div className="rounded-xl bg-white/30 dark:bg-white/[0.05] backdrop-blur-3xl border border-white/50 dark:border-white/[0.10] shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <button
            onClick={onLogout}
            className="p-2.5 text-gray-500 dark:text-white/40 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

const SESSION_TIMEOUT_MS  = 30 * 60 * 1000
const SESSION_WARNING_MS  = 28 * 60 * 1000  // Warning 2 min antes del timeout
const PERMS_INTERVAL_MS   =  5 * 60 * 1000

function InitDots() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-primary"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Layout() {
  const setPermissions    = useAuthStore(s => s.setPermissions)
  const accessToken       = useAuthStore(s => s.accessToken)
  const user              = useAuthStore(s => s.user)
  const logout            = useAuthStore(s => s.logout)
  const permissionsLoaded = useAuthStore(s => s.permissionsLoaded)
  const navigate          = useNavigate()
  const location          = useLocation()

  // Inicializando si: (F5 — accessToken aún no recuperado) O (permisos aún no cargados)
  // En ambos casos mostramos InitDots en lugar de pantalla en blanco.
  const isInitializing = (!accessToken && !!user) || !permissionsLoaded

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSessionWarning, setShowSessionWarning] = useState(false)

  // ── Logout con invalidación en servidor ────────────────────────────────────
  // Limpia estado y navega de inmediato; la llamada al backend va en el fondo
  const doLogout = useCallback(() => {
    authApi.logout().catch(() => {})
    logout()
    navigate('/login', { replace: true })
  }, [logout, navigate])

  // ── Timeout de inactividad — 30 min con warning a los 28 min ──────────────
  const resetTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current)
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    setShowSessionWarning(false)
    warningTimer.current = setTimeout(() => setShowSessionWarning(true), SESSION_WARNING_MS)
    inactivityTimer.current = setTimeout(doLogout, SESSION_TIMEOUT_MS)
  }, [doLogout])

  useEffect(() => {
    if (!accessToken) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimers, { passive: true }))
    resetTimers()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimers))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
      if (warningTimer.current) clearTimeout(warningTimer.current)
    }
  }, [accessToken, resetTimers])

  // ── Carga y refresco de permisos ────────────────────────────────────────────
  const user = useAuthStore(s => s.user)
  const lastRefreshRef = useRef(0)

  useEffect(() => {
    if (!accessToken) return

    const refresh = (force = false) => {
      const now = Date.now()
      if (!force && now - lastRefreshRef.current < 5_000) return
      lastRefreshRef.current = now
      permisosApi.getForMyRole()
        .then(perms => {
          if (Object.keys(perms).length > 0) setPermissions(perms)
        })
        .catch(() => {
          // Si el servidor no responde y los permisos nunca cargaron,
          // usar la matriz local para que la app no quede en blanco.
          if (!permissionsLoaded) {
            const role = user?.role ?? 'staff'
            const fallback = MATRIX[role as keyof typeof MATRIX] ?? {}
            setPermissions(fallback as Record<string, Record<string, boolean>>)
          }
        })
    }

    refresh(true)

    // Refrescar al recuperar foco (el admin cambió permisos en otra pestaña)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)

    // Refrescar cada 5 minutos para detectar cambios de rol en sesiones largas
    const interval = setInterval(() => refresh(true), PERMS_INTERVAL_MS)

    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [accessToken, setPermissions])

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-[#E8E6E3] dark:bg-[#050505] transition-colors duration-300">

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

      {user?.role === 'cliente_comun' ? (
        <KioskHeader onLogout={doLogout} />
      ) : (
        <Navbar />
      )}
      <main className="flex-1 px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6 lg:px-12 lg:py-7 xl:px-16 xl:py-8 overflow-auto text-gray-800 dark:text-gray-100 relative z-10 w-full max-w-[1600px] mx-auto">
        {isInitializing ? <InitDots /> : (
          <AnimatePresence initial={false}>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, position: 'absolute', inset: 0, pointerEvents: 'none' }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Suspense fallback={<InitDots />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <ToastContainer />
      <ServerDownScreen />

      {/* Warning de sesión a punto de expirar */}
      <Modal isOpen={showSessionWarning} onClose={resetTimers} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
              <Clock size={18} className="text-amber-500" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-white">Sesión a punto de expirar</p>
              <p className="text-sm text-gray-500 dark:text-[#8A8A9A] mt-1 leading-relaxed">
                Tu sesión se cerrará en 2 minutos por inactividad.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={doLogout}>
              Cerrar sesión
            </Button>
            <Button variant="primary" className="flex-1" onClick={resetTimers}>
              Continuar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
