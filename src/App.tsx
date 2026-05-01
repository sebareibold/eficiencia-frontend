import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { useThemeApplier } from './hooks/useThemeApplier'
import PrivateRoute from './guards/PrivateRoute'
import RoleGuard from './guards/RoleGuard'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import ClientsPage from './pages/ClientsPage'
import ClientProfilePage from './pages/ClientProfilePage'
import PaymentsPage from './pages/PaymentsPage'
import ShiftsPage from './pages/ShiftsPage'
import AttendancePage from './pages/AttendancePage'
import CalendarPage from './pages/CalendarPage'
import ExpensesPage from './pages/ExpensesPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  useThemeApplier()

  return (
    <BrowserRouter>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to={ROUTES.CLIENTS} replace />} />
            <Route path={ROUTES.CLIENTS} element={<ClientsPage />} />
            <Route path={ROUTES.CLIENT_PROFILE} element={<ClientProfilePage />} />
            <Route path={ROUTES.PAYMENTS} element={<PaymentsPage />} />
            <Route path={ROUTES.SHIFTS} element={<ShiftsPage />} />
            <Route path={ROUTES.ATTENDANCE} element={<AttendancePage />} />
            <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />

            {/* Solo admin */}
            <Route element={<RoleGuard />}>
              <Route path={ROUTES.EXPENSES} element={<ExpensesPage />} />
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.CLIENTS} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
