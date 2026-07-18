import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

// Detecta campos date-only: "2026-03-10", "2026-03-10T00:00:00.000Z", "2026-03-10T00:00:00Z"
// Estos se almacenan como medianoche UTC → en UTC-3 parseISO los mostraría un día antes
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z?)?$/

export function formatDate(date: string | Date, pattern = 'dd/MM/yyyy'): string {
  let d: Date
  if (typeof date === 'string') {
    if (DATE_ONLY_RE.test(date)) {
      // Parsear como fecha local para evitar desfase por UTC-3
      const [y, mo, dy] = date.slice(0, 10).split('-').map(Number)
      d = new Date(y, mo - 1, dy)
    } else {
      // Timestamp real (createdAt, etc.) → respetar timezone
      d = parseISO(date)
    }
  } else {
    d = date
  }
  return format(d, pattern, { locale: es })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy HH:mm', { locale: es })
}
