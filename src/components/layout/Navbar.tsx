import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, LogOut, Users, CreditCard, Calendar, LayoutDashboard, MoreHorizontal } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { ROUTES } from '../../constants/routes'
import { useState, useRef, useLayoutEffect, useEffect } from 'react'

const NAV_TABS = [
  { label: 'Dashboard', to: ROUTES.DASHBOARD, adminOnly: true, icon: LayoutDashboard },
  { label: 'Clientes', to: ROUTES.CLIENTS, adminOnly: false, icon: Users },
  { label: 'Turnos', to: ROUTES.SHIFTS, adminOnly: false, icon: Calendar },
  { label: 'Pagos', to: ROUTES.PAYMENTS, adminOnly: false, icon: CreditCard },
]

export default function Navbar() {
  const { user, logout } = useAuthStore()
  const { openSettings } = useUiStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = user?.role === 'admin'

  function handleLogout() {
    logout()
    navigate(ROUTES.LOGIN)
  }

  const visibleTabs = NAV_TABS.filter((t) => !t.adminOnly || isAdmin)

  const initials = user
    ? `${user.name.charAt(0)}${user.lastName?.charAt(0) ?? ''}`.toUpperCase()
    : '?'

  const containerRef = useRef<HTMLElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(visibleTabs.length)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const updateVisibleCount = () => {
      if (!containerRef.current || !measureRef.current) return

      const containerWidth = containerRef.current.offsetWidth
      const measureChildren = Array.from(measureRef.current.children) as HTMLElement[]

      let currentWidth = 0
      let newVisibleCount = visibleTabs.length
      const gap = 6
      const moreBtnWidth = 100 // approximate width of 'Más' button with icon and padding

      for (let i = 0; i < measureChildren.length; i++) {
        currentWidth += measureChildren[i].offsetWidth
        if (i > 0) currentWidth += gap

        if (i < measureChildren.length - 1) {
          if (currentWidth + gap + moreBtnWidth > containerWidth) {
            newVisibleCount = i
            break
          }
        } else {
          if (currentWidth > containerWidth) {
            newVisibleCount = i
            break
          }
        }
      }

      setVisibleCount(Math.max(0, newVisibleCount))
    }

    updateVisibleCount()

    const observer = new ResizeObserver(() => {
      updateVisibleCount()
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [visibleTabs.length])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setIsDropdownOpen(false)
  }, [location.pathname])

  const visibleItems = visibleTabs.slice(0, visibleCount)
  const hiddenItems = visibleTabs.slice(visibleCount)
  
  const isHiddenItemActive = hiddenItems.some(tab => location.pathname.startsWith(tab.to))

  return (
    <header className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-4">
      {/* Logo Section: Large Icon Card */}
      <div className="flex items-center shrink-0">
        <div className="bg-white p-2 sm:p-2.5 rounded-2xl flex items-center justify-center shadow-md border border-gray-100/50">
          <img 
            src="/logo-outline.png" 
            alt="Eficiencia Logo Icon" 
            className="h-8 sm:h-9 w-auto object-contain"
          />
        </div>
      </div>

      {/* Pill tabs container */}
      <div className="flex-1 min-w-0 flex justify-center" ref={containerRef}>
        <nav 
          className="w-full max-w-max flex items-center justify-center gap-1 sm:gap-1.5 rounded-2xl bg-white/50 backdrop-blur-xl p-1.5 shadow-md border border-white/80 relative z-10"
        >
          {/* Invisible container for measuring natural widths */}
          <div 
            ref={measureRef} 
            className="absolute top-0 left-0 flex items-center gap-1 sm:gap-1.5 opacity-0 pointer-events-none invisible"
            aria-hidden="true"
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon
              return (
                <div
                  key={`measure-${tab.to}`}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-[0.7rem] sm:text-xs font-semibold uppercase whitespace-nowrap"
                >
                  <Icon size={16} strokeWidth={2.5} />
                  <span>{tab.label}</span>
                </div>
              )
            })}
          </div>

          {/* Visible tabs */}
          {visibleItems.map((tab) => {
            const Icon = tab.icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `relative flex items-center gap-2 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-[0.7rem] sm:text-xs font-semibold uppercase transition-colors duration-300 whitespace-nowrap outline-none ${
                    isActive
                      ? 'text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60 hover:shadow-sm border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-pill"
                        className="absolute inset-0 bg-gray-900 shadow-xl border border-gray-700 rounded-xl"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <Icon size={16} strokeWidth={2.5} className={`relative z-10 transition-colors ${isActive ? 'opacity-100' : 'opacity-80'}`} />
                    <span className="relative z-10">{tab.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}

          {/* More dropdown */}
          {hiddenItems.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`relative flex items-center gap-2 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-[0.7rem] sm:text-xs font-semibold uppercase transition-colors duration-300 whitespace-nowrap outline-none ${
                  isHiddenItemActive || isDropdownOpen
                    ? 'text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60 hover:shadow-sm border border-transparent'
                }`}
              >
                {(isHiddenItemActive || isDropdownOpen) && (
                  <motion.div
                    layoutId="active-nav-pill"
                    className="absolute inset-0 bg-gray-900 shadow-xl border border-gray-700 rounded-xl"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                <MoreHorizontal size={16} strokeWidth={2.5} className={`relative z-10 transition-colors ${isHiddenItemActive || isDropdownOpen ? 'opacity-100' : 'opacity-80'}`} />
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
                              isActive
                                ? 'bg-gray-100 text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`
                          }
                        >
                          <Icon size={18} strokeWidth={2.5} />
                          <span>{tab.label}</span>
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

      {/* Right actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {isAdmin && (
          <button
            onClick={openSettings}
            className="flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 bg-white/60 backdrop-blur-lg rounded-xl shadow-md text-gray-600 hover:text-gray-900 hover:bg-white/80 transition-all border border-white/80"
            title="Configuración"
          >
            <Settings size={20} />
          </button>
        )}
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-lg rounded-xl p-1 pl-3 shadow-md border border-white/80">
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gray-200/80 backdrop-blur-sm flex items-center justify-center text-xs font-bold text-gray-700 shadow-sm">
            {initials}
          </div>
        </div>
      </div>
    </header>
  )
}
