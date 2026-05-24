import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { useThemeApplier } from './hooks/useThemeApplier'
import PrivateRoute from './guards/PrivateRoute'
import PermissionGuard from './guards/PermissionGuard'
import Layout from './components/layout/Layout'
import ScrollToTop from './components/layout/ScrollToTop'
import LoginPage from './pages/LoginPage'
import ClientsPage from './pages/ClientsPage'
import ClientProfilePage from './pages/ClientProfilePage'
import ClientRutinaPage from './pages/ClientRutinaPage'
import CreateClientPage from './pages/CreateClientPage'
import PaymentsPage from './pages/PaymentsPage'
import PaymentDetailPage from './pages/PaymentDetailPage'
import ShiftsPage from './pages/ShiftsPage'
import ShiftDetailPage from './pages/ShiftDetailPage'
import AttendancePage from './pages/AttendancePage'
import CalendarPage from './pages/CalendarPage'
import ExpensesPage from './pages/ExpensesPage'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import ExercisesPage from './pages/ExercisesPage'

export default function App() {
  useThemeApplier()

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to={ROUTES.CLIENTS} replace />} />

            {/* Rutas con permiso 'clients' */}
            <Route element={<PermissionGuard module="clients" />}>
              <Route path={ROUTES.CLIENTS} element={<ClientsPage />} />
              <Route path={ROUTES.CLIENT_NEW} element={<CreateClientPage />} />
              <Route path={ROUTES.CLIENT_PROFILE} element={<ClientProfilePage />} />
              <Route path={ROUTES.CLIENT_RUTINA} element={<ClientRutinaPage />} />
            </Route>

            {/* Rutas con permiso 'payments' */}
            <Route element={<PermissionGuard module="payments" />}>
              <Route path={ROUTES.PAYMENTS} element={<PaymentsPage />} />
              <Route path={ROUTES.PAYMENT_DETAIL} element={<PaymentDetailPage />} />
            </Route>

            {/* Rutas con permiso 'shifts' */}
            <Route element={<PermissionGuard module="shifts" />}>
              <Route path={ROUTES.SHIFTS} element={<ShiftsPage />} />
              <Route path={ROUTES.SHIFT_DETAIL} element={<ShiftDetailPage />} />
              <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
            </Route>

            {/* Rutas con permiso 'attendance' */}
            <Route element={<PermissionGuard module="attendance" />}>
              <Route path={ROUTES.ATTENDANCE} element={<AttendancePage />} />
            </Route>

            {/* Ejercicios — acceso general autenticado */}
            <Route path={ROUTES.EXERCISES} element={<ExercisesPage />} />

            {/* Rutas solo Administrador — gated por permiso 'read' */}
            <Route element={<PermissionGuard module="expenses" />}>
              <Route path={ROUTES.EXPENSES} element={<ExpensesPage />} />
            </Route>
            <Route element={<PermissionGuard module="dashboard" />}>
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            </Route>
            <Route element={<PermissionGuard module="users" />}>
              <Route path={ROUTES.USERS} element={<UsersPage />} />
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.CLIENTS} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
