import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ease, duration } from '../../lib/motion'
import {
  Settings, LogOut, Users, CreditCard, LayoutDashboard,
  MoreHorizontal, Dumbbell, Tag, Wallet, Menu, X, UserCog, BookOpen,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { usePermissions, type PermModule } from '../../hooks/usePermissions'
import { useSolicitudesStore } from '../../store/solicitudesStore'
import { authApi } from '../../api/auth.api'
import { solicitudesApi } from '../../api/solicitudes.api'
import { ROUTES } from '../../constants/routes'
import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react'

const NAV_TABS: { label: string; to: string; module: PermModule | null; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { label: 'Dashboard',  to: ROUTES.DASHBOARD, module: 'dashboard',  icon: LayoutDashboard },
  { label: 'Turnos',     to: ROUTES.SHIFTS,    module: 'shifts',     icon: Dumbbell },
  { label: 'Clientes',   to: ROUTES.CLIENTS,   module: 'clients',    icon: Users },
  { label: 'Pagos',      to: ROUTES.PAYMENTS,  module: 'payments',   icon: CreditCard },
  { label: 'Gastos',     to: ROUTES.EXPENSES,  module: 'expenses',   icon: Wallet },
  { label: 'Biblioteca', to: ROUTES.EXERCISES, module: null,    icon: BookOpen },
  { label: 'Usuarios',   to: ROUTES.USERS,     module: 'users', icon: UserCog },
]

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const { openSettings } = useUiStore()
  const { canUI } = usePermissions()
  const { pendingCount, setPendingCount } = useSolicitudesStore()
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const handleLogout = useCallback(async () => {
    try { await authApi.logout() } catch { /* ignorar errores de red */ }
    logout()
    navigate(ROUTES.LOGIN)
  }, [logout, navigate])

  const visibleTabs = NAV_TABS.filter(t => t.module === null || canUI(t.module, 'read'))

  const isAdmin        = user?.role === 'admin'
  const isClienteComun = user?.role === 'cliente_comun'

  useEffect(() => {
    if (!isAdmin) return
    solicitudesApi.getAll()
      .then(list => setPendingCount(list.filter(s => s.estado === 'PENDIENTE').length))
      .catch(() => {})
  }, [isAdmin, setPendingCount])

  const initials = user
    ? `${user.name.charAt(0)}${user.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?'

  // ─── ResizeObserver for desktop pill overflow ──────────────────────────────
  const containerRef = useRef<HTMLElement>(null)
  const measureRef   = useRef<HTMLDivElement>(null)
  const dropdownRef  = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(visibleTabs.length)

  useLayoutEffect(() => {
    const update = () => {
      if (!containerRef.current || !measureRef.current) return
      const containerWidth = containerRef.current.offsetWidth
      const children = Array.from(measureRef.current.children) as HTMLElement[]
      let w = 0
      let count = visibleTabs.length
      const gap = 6
      const moreBtnW = 100
      for (let i = 0; i < children.length; i++) {
        w += children[i].offsetWidth
        if (i > 0) w += gap
        if (i < children.length - 1) {
          if (w + gap + moreBtnW > containerWidth) { count = i; break }
        } else {
          if (w > containerWidth) { count = i; break }
        }
      }
      setVisibleCount(Math.max(0, count))
    }
    update()
    const obs = new ResizeObserver(update)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [visibleTabs.length])

  // ─── Close handlers ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setIsDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setIsDropdownOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const visibleItems     = visibleTabs.slice(0, visibleCount)
  const hiddenItems      = visibleTabs.slice(visibleCount)
  const isHiddenItemActive = hiddenItems.some(t => location.pathname.startsWith(t.to))

  if (isClienteComun) {
    return (
      <header className="flex items-center justify-between gap-4 px-4 sm:px-5 md:px-8 lg:px-12 xl:px-16 py-4 w-full max-w-[1600px] mx-auto relative z-20">
        <div className="flex items-center shrink-0">
          <img src="/logo.png" alt="Eficiencia Logo" className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm" />
        </div>
        <nav className="flex items-center gap-2 p-1.5">
          <NavLink
            to={ROUTES.EJECUCION}
            className={({ isActive }) =>
              `relative flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-colors duration-300 whitespace-nowrap outline-none ${
                isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="absolute inset-0 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04),0_0_16px_rgba(251,198,8,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(251,198,8,0.22)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                <BookOpen size={16} strokeWidth={2.5} className={`relative z-10 ${isActive ? 'opacity-100' : 'opacity-80'}`} />
                <span className="relative z-10">Mi rutina</span>
              </>
            )}
          </NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center h-10 w-10 text-gray-400 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={16} strokeWidth={2.5} />
          </button>
          <div className="h-9 w-9 rounded-full border-2 border-white bg-white flex items-center justify-center text-xs font-bold text-gray-700 shadow-sm">
            {initials}
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-4 sm:px-5 md:px-8 lg:px-12 xl:px-16 py-4 w-full max-w-[1600px] mx-auto relative z-20">

        {/* Logo */}
        <div className="flex items-center shrink-0">
          <img src="/logo.png" alt="Eficiencia Logo" className="h-10 sm:h-12 w-auto object-contain drop-shadow-sm" />
        </div>

        {/* ── Desktop pill nav (hidden on mobile) ────────────────────────── */}
        <div className="hidden md:flex flex-1 min-w-0 justify-center" ref={containerRef}>
          <nav className="w-full max-w-max flex items-center justify-center gap-2 sm:gap-4 p-1.5 relative z-10">
            {/* Invisible measure strip */}
            <div
              ref={measureRef}
              className="absolute top-0 left-0 flex items-center gap-1 sm:gap-1.5 opacity-0 pointer-events-none invisible"
              aria-hidden="true"
            >
              {visibleTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <div key={`m-${tab.to}`} className="flex items-center gap-2 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-[0.7rem] sm:text-xs font-semibold uppercase whitespace-nowrap">
                    <Icon size={16} strokeWidth={2.5} />
                    <span>{tab.label}</span>
                  </div>
                )
              })}
            </div>

            {visibleItems.map((tab) => {
              const Icon = tab.icon
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2 rounded-full px-4 py-2 sm:px-5 sm:py-2.5 text-[0.7rem] sm:text-xs font-semibold transition-colors duration-300 whitespace-nowrap outline-none ${
                      isActive ? 'text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-pill"
                          className="absolute inset-0 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04),0_0_16px_rgba(251,198,8,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(251,198,8,0.22)]"
                          transition={{ type: 'spring', stiffness: 380, damping: 30, duration: duration.base }}
                          style={{ zIndex: -1 }}
                        />
                      )}
                      <Icon size={16} strokeWidth={2.5} className={`relative z-10 transition-colors ${isActive ? 'opacity-100' : 'opacity-80'}`} />
                      <span className="relative z-10">{tab.label}</span>
                      {tab.to === ROUTES.USERS && pendingCount > 0 && (
                        <span className="relative z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white leading-none">
                          {pendingCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}

            {hiddenItems.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`relative flex items-center gap-2 rounded-full px-4 py-2 sm:px-5 sm:py-2.5 text-[0.7rem] sm:text-xs font-semibold transition-colors duration-300 whitespace-nowrap outline-none ${
                    isHiddenItemActive || isDropdownOpen ? 'text-gray-900 dark:text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {(isHiddenItemActive || isDropdownOpen) && (
                    <motion.div
                      layoutId="active-nav-pill"
                      className="absolute inset-0 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04),0_0_16px_rgba(251,198,8,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(251,198,8,0.22)]"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <MoreHorizontal size={16} strokeWidth={2.5} className={`relative z-10 ${isHiddenItemActive || isDropdownOpen ? 'opacity-100' : 'opacity-80'}`} />
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full mt-2 right-0 bg-white/90 backdrop-blur-xl border border-gray-200 shadow-xl rounded-2xl p-2 min-w-[200px] z-50 flex flex-col gap-1"
                    >
                      {hiddenItems.map((tab) => {
                        const Icon = tab.icon
                        return (
                          <NavLink
                            key={tab.to}
                            to={tab.to}
                            className={({ isActive }) =>
                              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold uppercase transition-all duration-200 outline-none w-full ${
                                isActive ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                              }`
                            }
                          >
                            <Icon size={18} strokeWidth={2.5} />
                            <span className="flex-1">{tab.label}</span>
                            {tab.to === ROUTES.USERS && pendingCount > 0 && (
                              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white leading-none">
                                {pendingCount}
                              </span>
                            )}
                          </NavLink>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </nav>
        </div>

        {/* ── Desktop right actions (hidden on mobile) ───────────────────── */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {isAdmin && (
            <NavLink
              to={ROUTES.SETTINGS}
              className={({ isActive }) =>
                `relative flex items-center justify-center h-10 w-10 rounded-full transition-colors ${isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'}`
              }
              title="Configuración"
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="active-nav-pill"
                      className="absolute inset-0 rounded-full bg-white/30 dark:bg-black/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04),0_0_16px_rgba(251,198,8,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(251,198,8,0.22)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      style={{ zIndex: 0 }}
                    />
                  )}
                  <Settings size={18} strokeWidth={2.5} className="relative z-10" />
                </>
              )}
            </NavLink>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center h-10 w-10 text-gray-400 hover:text-red-500 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} strokeWidth={2.5} />
            </button>
            <div className="h-9 w-9 rounded-full border-2 border-white bg-white flex items-center justify-center text-xs font-bold text-gray-700 shadow-sm ml-2">
              {initials}
            </div>
          </div>
        </div>

        {/* ── Mobile burger button ───────────────────────────────────────── */}
        <button
          onClick={() => setMobileOpen(prev => !prev)}
          className="md:hidden flex items-center justify-center h-10 w-10 rounded-xl border border-white/60 dark:border-white/[0.15] bg-white/30 dark:bg-white/[0.08] text-gray-700 dark:text-gray-300 backdrop-blur-3xl shadow-sm transition-all hover:bg-white/50 dark:hover:bg-white/[0.14] active:scale-95 shrink-0"
          aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileOpen ? (
              <motion.span
                key="x"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex"
              >
                <X size={19} strokeWidth={2} />
              </motion.span>
            ) : (
              <motion.span
                key="burger"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex"
              >
                <Menu size={19} strokeWidth={2} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </header>

      {/* ── Mobile full-screen menu ─────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[90] bg-black/40 dark:bg-black/60 backdrop-blur-[2px] md:hidden"
              onClick={() => setMobileOpen(false)}
            />

            {/* Slide panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.85 }}
              className="fixed inset-y-0 right-0 z-[91] flex flex-col w-[82%] max-w-[340px] md:hidden bg-white/85 dark:bg-[#0f0f0f]/92 backdrop-blur-3xl border-l border-white/60 dark:border-white/[0.10] shadow-2xl"
            >
              {/* ── Header ────────────────────────────────────────────── */}
              <div className="relative flex items-center justify-end px-5 pt-5 pb-4 border-b border-gray-200/60 dark:border-white/[0.07]">
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-xl bg-black/[0.06] dark:bg-white/[0.08] text-gray-600 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/[0.13] transition-colors"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              </div>

              {/* ── Nav items ─────────────────────────────────────────── */}
              <nav className="relative flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                {visibleTabs.map((tab, i) => {
                  const Icon = tab.icon
                  return (
                    <motion.div
                      key={tab.to}
                      initial={{ opacity: 0, x: 28 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.045 + 0.06, type: 'spring', stiffness: 300, damping: 26 }}
                    >
                      <NavLink
                        to={tab.to}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `relative flex items-center gap-4 rounded-2xl px-5 py-[14px] text-[0.95rem] font-semibold transition-all duration-150 overflow-hidden ${
                            isActive
                              ? 'bg-white/30 dark:bg-black/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04),0_0_16px_rgba(251,198,8,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(251,198,8,0.22)] text-gray-900 dark:text-white'
                              : 'text-gray-600 dark:text-[#8A8A9A] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-full" />
                            )}
                            <Icon
                              size={20}
                              strokeWidth={2}
                              className={`shrink-0 transition-colors ${isActive ? 'text-primary' : ''}`}
                            />
                            <span className="flex-1">{tab.label}</span>
                            {tab.to === ROUTES.USERS && pendingCount > 0 && (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-black text-white leading-none">
                                {pendingCount}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </motion.div>
                  )
                })}
              </nav>

              {/* ── Footer: user + acciones ───────────────────────────── */}
              <div className="relative px-3 pb-8 pt-3 border-t border-gray-200/60 dark:border-white/[0.07] space-y-1">
                {/* User card */}
                <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04]">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-white dark:bg-white/10 border-2 border-white/80 dark:border-white/20 flex items-center justify-center text-xs font-black text-gray-800 dark:text-white shadow-sm">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate leading-tight">
                      {user?.name} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-[#8A8A9A] leading-tight mt-0.5">
                      {isAdmin ? 'Administrador' : 'Staff'}
                    </p>
                  </div>
                </div>

                {/* Settings (admin only) */}
                {isAdmin && (
                  <NavLink
                    to={ROUTES.SETTINGS}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-4 rounded-2xl px-5 py-[14px] text-[0.9rem] font-semibold transition-all duration-150 overflow-hidden ${
                        isActive
                          ? 'bg-white/30 dark:bg-black/30 backdrop-blur-3xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04),0_0_16px_rgba(251,198,8,0.18)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_20px_rgba(251,198,8,0.22)] text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-[#8A8A9A] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-gray-900 dark:hover:text-white'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-full" />
                        )}
                        <Settings size={19} strokeWidth={2} className={`shrink-0 ${isActive ? 'text-primary' : ''}`} />
                        <span>Configuración</span>
                      </>
                    )}
                  </NavLink>
                )}

                {/* Logout */}
                <button
                  onClick={() => { handleLogout(); setMobileOpen(false) }}
                  className="flex items-center gap-4 px-5 py-[14px] rounded-2xl w-full text-left text-[0.9rem] font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors"
                >
                  <LogOut size={19} strokeWidth={2} className="shrink-0" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
