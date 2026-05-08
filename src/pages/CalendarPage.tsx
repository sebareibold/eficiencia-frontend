import { Navigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

export default function CalendarPage() {
  return <Navigate to={ROUTES.SHIFTS} replace />
}
