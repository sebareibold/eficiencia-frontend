import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { useThemeApplier } from './hooks/useThemeApplier'
import { useAuthStore } from './store/authStore'

// ── Eager: guards, layout y navegación ────────────────────────────────────────
import PrivateRoute from './guards/PrivateRoute'
import PermissionGuard from './guards/PermissionGuard'
import Layout from './components/layout/Layout'
import ScrollToTop from './components/layout/ScrollToTop'

// ── Eager: páginas críticas del path inicial ──────────────────────────────────
import LoginPage from './pages/LoginPage'

// ── Lazy: todas las páginas autenticadas ──────────────────────────────────────
const ClientsPage        = lazy(() => import('./pages/ClientsPage'))
const ClientProfilePage  = lazy(() => import('./pages/ClientProfilePage'))
const ClientRutinaPage   = lazy(() => import('./pages/ClientRutinaPage'))
const AusenciaPage       = lazy(() => import('./pages/AusenciaPage'))
const CreateClientPage   = lazy(() => import('./pages/CreateClientPage'))
const PaymentsPage       = lazy(() => import('./pages/PaymentsPage'))
const PaymentNewPage     = lazy(() => import('./pages/PaymentNewPage'))
const PaymentDetailPage  = lazy(() => import('./pages/PaymentDetailPage'))
const ShiftsPage         = lazy(() => import('./pages/ShiftsPage'))
const ShiftNewPage       = lazy(() => import('./pages/ShiftNewPage'))
const ShiftDetailPage    = lazy(() => import('./pages/ShiftDetailPage'))
const AttendancePage     = lazy(() => import('./pages/AttendancePage'))
const CalendarPage       = lazy(() => import('./pages/CalendarPage'))
const ExpensesPage       = lazy(() => import('./pages/ExpensesPage'))
const DashboardPage      = lazy(() => import('./pages/DashboardPage'))
const UsersPage          = lazy(() => import('./pages/UsersPage'))
const UserNewPage        = lazy(() => import('./pages/UserNewPage'))
const SettingsPage       = lazy(() => import('./pages/SettingsPage'))
const ExercisesPage      = lazy(() => import('./pages/ExercisesPage'))
const PlantillasPage     = lazy(() => import('./pages/PlantillasPage'))
const EjercicioDetailPage = lazy(() => import('./pages/EjercicioDetailPage'))
const PlantillaViewPage   = lazy(() => import('./pages/PlantillaViewPage'))
const EjecucionPage      = lazy(() => import('./pages/EjecucionPage'))
const EjecucionRutinaPage = lazy(() => import('./pages/EjecucionRutinaPage'))
const CreateRutinaPage   = lazy(() => import('./pages/CreateRutinaPage'))
const SecurityPage       = lazy(() => import('./pages/SecurityPage'))
const ManualPage         = lazy(() => import('./pages/ManualPage'))

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
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <Suspense fallback={null}>
        <Routes>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />

          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route index element={<DefaultRedirect />} />

              <Route element={<PermissionGuard module="clients" />}>
                <Route path={ROUTES.CLIENTS}         element={<ClientsPage />} />
                <Route path={ROUTES.CLIENT_NEW}      element={<CreateClientPage />} />
                <Route path={ROUTES.CLIENT_PROFILE}  element={<ClientProfilePage />} />
                <Route path={ROUTES.CLIENT_AUSENCIA} element={<AusenciaPage />} />
              </Route>

              <Route element={<PermissionGuard module="payments" />}>
                <Route path={ROUTES.PAYMENTS}       element={<PaymentsPage />} />
                <Route path={ROUTES.PAYMENT_NEW}    element={<PaymentNewPage />} />
                <Route path={ROUTES.PAYMENT_DETAIL} element={<PaymentDetailPage />} />
              </Route>

              <Route element={<PermissionGuard module="shifts" />}>
                <Route path={ROUTES.SHIFTS}       element={<ShiftsPage />} />
                <Route path={ROUTES.SHIFT_NEW}    element={<ShiftNewPage />} />
                <Route path={ROUTES.SHIFT_DETAIL} element={<ShiftDetailPage />} />
                <Route path={ROUTES.CALENDAR}     element={<CalendarPage />} />
              </Route>

              <Route element={<PermissionGuard module="attendance" />}>
                <Route path={ROUTES.ATTENDANCE} element={<AttendancePage />} />
              </Route>

              <Route element={<PermissionGuard module="exercises" />}>
                <Route path={ROUTES.EXERCISES}       element={<ExercisesPage />} />
                <Route path={ROUTES.EXERCISE_DETAIL} element={<EjercicioDetailPage />} />
              </Route>

              <Route element={<PermissionGuard module="plantillas" />}>
                <Route path={ROUTES.PLANTILLA_NEW}    element={<PlantillaViewPage />} />
                <Route path={ROUTES.PLANTILLA_DETAIL} element={<PlantillaViewPage />} />
              </Route>

              <Route element={<PermissionGuard module="rutinas" />}>
                <Route path={ROUTES.CLIENT_RUTINA}    element={<ClientRutinaPage />} />
                <Route path={ROUTES.RUTINA_CREAR}     element={<CreateRutinaPage />} />
                <Route path={ROUTES.EJECUCION}        element={<EjecucionPage />} />
                <Route path={ROUTES.EJECUCION_RUTINA} element={<EjecucionRutinaPage />} />
              </Route>

              <Route element={<PermissionGuard module="expenses" />}>
                <Route path={ROUTES.EXPENSES} element={<ExpensesPage />} />
              </Route>
              <Route element={<PermissionGuard module="dashboard" />}>
                <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
              </Route>
              <Route element={<PermissionGuard module="users" />}>
                <Route path={ROUTES.USERS}    element={<UsersPage />} />
                <Route path={ROUTES.USER_NEW} element={<UserNewPage />} />
              </Route>

              {/* Accesibles a todos los usuarios autenticados */}
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              <Route path={ROUTES.MANUAL}   element={<ManualPage />} />
              <Route path={ROUTES.SECURITY} element={<SecurityPage />} />
            </Route>
          </Route>

          <Route path="*" element={<DefaultRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
