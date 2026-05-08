import type { ClientStatus } from '../constants/clientStatus'

const STATUS_CLASSES: Record<ClientStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  expiring: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  debt: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
  inactive: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200',
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
