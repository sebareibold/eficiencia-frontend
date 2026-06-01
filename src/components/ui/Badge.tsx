import { memo } from 'react'
import type { ClientStatus } from '../../constants/clientStatus'
import { getStatusColor, getStatusLabel } from '../../utils/getStatusColor'

interface BadgeProps {
  status: ClientStatus
  className?: string
}

const DOT_CLASSES: Record<ClientStatus, string> = {
  active: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  debt: 'bg-red-500',
  inactive: 'bg-gray-400',
}

const Badge = memo(function Badge({ status, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(status)} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[status]}`} />
      <span>{getStatusLabel(status)}</span>
    </span>
  )
})

export default Badge
