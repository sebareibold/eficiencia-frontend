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
  emptyMessage = 'Sin resultados',
}: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-custom-border">
      <table className="w-full text-sm">
        <thead className="border-b border-custom-border bg-[#111111]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] ${col.sortable ? 'cursor-pointer select-none hover:text-white' : ''}`}
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
        <tbody className="divide-y divide-custom-border">
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
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[#9CA3AF]">
                  {emptyMessage}
                </td>
              </tr>
            )
            : data.map((row) => (
              <tr key={keyExtractor(row)} className="hover:bg-white/5 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-white">
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
