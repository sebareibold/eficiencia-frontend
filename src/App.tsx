import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './constants/routes'
import { useThemeApplier } from './hooks/useThemeApplier'
import PrivateRoute from './guards/PrivateRoute'
import RoleGuard from './guards/RoleGuard'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import ClientsPage from './pages/ClientsPage'
import ClientProfilePage from './pages/ClientProfilePage'
import ClientRutinaPage from './pages/ClientRutinaPage'
import PaymentsPage from './pages/PaymentsPage'
import ShiftsPage from './pages/ShiftsPage'
import ShiftDetailPage from './pages/ShiftDetailPage'
import AttendancePage from './pages/AttendancePage'
import CalendarPage from './pages/CalendarPage'
import ExpensesPage from './pages/ExpensesPage'
import MembershipsPage from './pages/MembershipsPage'
import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import ExercisesPage from './pages/ExercisesPage'

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
            <Route path={ROUTES.CLIENT_RUTINA} element={<ClientRutinaPage />} />
            <Route path={ROUTES.PAYMENTS} element={<PaymentsPage />} />
            <Route path={ROUTES.SHIFTS} element={<ShiftsPage />} />
            <Route path={ROUTES.SHIFT_DETAIL} element={<ShiftDetailPage />} />
            <Route path={ROUTES.ATTENDANCE} element={<AttendancePage />} />
            <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
            <Route path={ROUTES.EXERCISES} element={<ExercisesPage />} />

            {/* Solo admin */}
            <Route element={<RoleGuard />}>
              <Route path={ROUTES.EXPENSES} element={<ExpensesPage />} />
              <Route path={ROUTES.MEMBERSHIPS} element={<MembershipsPage />} />
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
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
