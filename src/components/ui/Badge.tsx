import type { ClientStatus } from '../../constants/clientStatus'
import { getStatusColor, getStatusLabel } from '../../utils/getStatusColor'

interface BadgeProps {
  status: ClientStatus
  className?: string
}

export default function Badge({ status, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(status)} ${className}`}
    >
      {getStatusLabel(status)}
    </span>
  )
}
