import { type ReactNode } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import Skeleton from './Skeleton'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string | number
  isLoading?: boolean
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export default function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  emptyMessage = 'Sin resultados',
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      <table className="w-full text-sm">
        <thead className="border-b border-white/20 dark:border-white/10 bg-gray-50/30 dark:bg-black/10">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-saas-muted ${col.sortable ? 'cursor-pointer select-none hover:text-gray-900' : ''}`}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/20 dark:divide-white/10">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            : data.length === 0
            ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-saas-muted">
                  {emptyMessage}
                </td>
              </tr>
            )
            : data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`group transition-all duration-150 hover:bg-gray-50/80 dark:hover:bg-white/[0.04] ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-900">
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
