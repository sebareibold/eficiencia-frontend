import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { useThemeApplier } from './hooks/useThemeApplier'
import { useAuthStore } from './store/authStore'
import AppSkeleton from './components/ui/AppSkeleton'

// ── Eager: guards y layout base ───────────────────────────────────────────────
import PrivateRoute from './guards/PrivateRoute'
import PermissionGuard from './guards/PermissionGuard'

// ── Lazy: layout y páginas autenticadas (framer-motion + lucide fuera del bundle inicial)
const Layout      = lazy(() => import('./components/layout/Layout'))
const ScrollToTop = lazy(() => import('./components/layout/ScrollToTop'))

// ── Eager: páginas críticas del path inicial ──────────────────────────────────
import LoginPage from './pages/LoginPage'

// ── Lazy: todas las páginas autenticadas ──────────────────────────────────────
const ClientsPage        = lazy(() => import('./pages/ClientsPage'))
const ClientProfilePage  = lazy(() => import('./pages/ClientProfilePage'))
const ClientRutinaPage   = lazy(() => import('./pages/ClientRutinaPage'))
const CreateClientPage   = lazy(() => import('./pages/CreateClientPage'))
const PaymentsPage       = lazy(() => import('./pages/PaymentsPage'))
const PaymentDetailPage  = lazy(() => import('./pages/PaymentDetailPage'))
const ShiftsPage         = lazy(() => import('./pages/ShiftsPage'))
const ShiftDetailPage    = lazy(() => import('./pages/ShiftDetailPage'))
const AttendancePage     = lazy(() => import('./pages/AttendancePage'))
const CalendarPage       = lazy(() => import('./pages/CalendarPage'))
const ExpensesPage       = lazy(() => import('./pages/ExpensesPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const UsersPage          = lazy(() => import('./pages/UsersPage'))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))
const ExercisesPage      = lazy(() => import('./pages/ExercisesPage'))
const PlantillasPage     = lazy(() => import('./pages/PlantillasPage'))
const EjercicioDetailPage = lazy(() => import('./pages/EjercicioDetailPage'))
const PlantillaDetailPage = lazy(() => import('./pages/PlantillaDetailPage'))
const EjecucionPage      = lazy(() => import('./pages/EjecucionPage'))
const CreateRutinaPage   = lazy(() => import('./pages/CreateRutinaPage'))

function DefaultRedirect() {
  const user = useAuthStore((s) => s.user)
  let to = ROUTES.CLIENTS
  if (user?.role === 'admin')          to = ROUTES.DASHBOARD
  else if (user?.role === 'profesor')  to = ROUTES.SHIFTS
  else if (user?.role === 'cliente_comun') to = ROUTES.EJECUCION
  return <Navigate to={to} replace />
}

export default function App() {
  useThemeApplier()

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<AppSkeleton />}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DefaultRedirect />} />

              <Route element={<PermissionGuard module="clients" />}>
                <Route path={ROUTES.CLIENTS}       element={<ClientsPage />} />
                <Route path={ROUTES.CLIENT_NEW}    element={<CreateClientPage />} />
                <Route path={ROUTES.CLIENT_PROFILE} element={<ClientProfilePage />} />
                <Route path={ROUTES.CLIENT_RUTINA} element={<ClientRutinaPage />} />
              </Route>

              <Route element={<PermissionGuard module="payments" />}>
                <Route path={ROUTES.PAYMENTS}       element={<PaymentsPage />} />
                <Route path={ROUTES.PAYMENT_DETAIL} element={<PaymentDetailPage />} />
              </Route>

              <Route element={<PermissionGuard module="shifts" />}>
                <Route path={ROUTES.SHIFTS}       element={<ShiftsPage />} />
                <Route path={ROUTES.SHIFT_DETAIL} element={<ShiftDetailPage />} />
                <Route path={ROUTES.CALENDAR}     element={<CalendarPage />} />
              </Route>

              <Route element={<PermissionGuard module="attendance" />}>
                <Route path={ROUTES.ATTENDANCE} element={<AttendancePage />} />
              </Route>

              <Route path={ROUTES.EXERCISES}       element={<ExercisesPage />} />
              <Route path={ROUTES.EXERCISE_NEW}    element={<EjercicioDetailPage />} />
              <Route path={ROUTES.EXERCISE_DETAIL} element={<EjercicioDetailPage />} />
              <Route path={ROUTES.PLANTILLA_NEW}   element={<PlantillaDetailPage />} />
              <Route path={ROUTES.PLANTILLA_DETAIL} element={<PlantillaDetailPage />} />

              <Route path={ROUTES.RUTINA_CREAR}    element={<CreateRutinaPage />} />
              <Route path={ROUTES.EJECUCION}       element={<EjecucionPage />} />

              <Route element={<PermissionGuard module="expenses" />}>
                <Route path={ROUTES.EXPENSES} element={<ExpensesPage />} />
              </Route>
              <Route element={<PermissionGuard module="dashboard" />}>
                <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
              </Route>
              <Route element={<PermissionGuard module="users" />}>
                <Route path={ROUTES.USERS}    element={<UsersPage />} />
                <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
