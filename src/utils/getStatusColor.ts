import type { ClientStatus } from '../constants/clientStatus'

const STATUS_CLASSES: Record<ClientStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  expiring: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  debt: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  inactive: 'bg-gray-500/10 text-gray-500 dark:text-gray-400 border border-gray-500/20',
}

const STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'ACTIVO',
  expiring: 'POR VENCER',
  debt: 'EN DEUDA',
  inactive: 'INACTIVO',
}

export function getStatusColor(status: ClientStatus): string {
  return STATUS_CLASSES[status] ?? 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200'
}

export function getStatusLabel(status: ClientStatus): string {
  return STATUS_LABELS[status] ?? status
}
