import type { ClientStatus } from '../constants/clientStatus'

const STATUS_COLORS: Record<ClientStatus, string> = {
  active: 'bg-green-500',
  expiring: 'bg-yellow-400',
  debt: 'bg-red-500',
  inactive: 'bg-gray-500',
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'Activo',
  expiring: 'Por vencer',
  debt: 'Deuda',
  inactive: 'Inactivo',
}

export function getStatusColor(status: ClientStatus): string {
  return STATUS_COLORS[status] ?? 'bg-gray-500'
}

export function getStatusLabel(status: ClientStatus): string {
  return STATUS_LABELS[status] ?? status
}
