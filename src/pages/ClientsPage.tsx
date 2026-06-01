import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import { Plus, Search, RefreshCw, LayoutList, LayoutGrid, ChevronRight, Phone, Mail } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { useClients } from '../hooks/useClients'
import Badge from '../components/ui/Badge'
import Table, { type Column } from '../components/ui/Table'
import Skeleton from '../components/ui/Skeleton'
import type { Client } from '../types/client.types'
import type { ClientStatus } from '../constants/clientStatus'

type StatusFilter = 'all' | ClientStatus

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activo' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'debt', label: 'Deuda' },
  { value: 'inactive', label: 'Inactivo' },
]


export default function ClientsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const { clients, isLoading, error, refetch } = useClients()

  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clients.filter(c => {
      const matchesSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.dni?.includes(q)
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [clients, search, statusFilter])

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900 dark:text-white">{c.name} {c.lastName}</span>
          <span className="text-xs text-saas-muted">DNI {c.dni}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contacto',
      render: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-saas-muted">{c.email || '—'}</span>
          {c.phone && <span className="text-xs text-saas-muted">{c.phone}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (c) => <Badge status={c.status} />,
    },
    {
      key: 'planName',
      header: 'Plan',
      render: (c) => (
        c.planName
          ? <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-gray-900 dark:text-white">{c.planName}</span>
              {c.planFrequency && (
                <span className="text-xs text-saas-muted">{c.planFrequency}× por semana</span>
              )}
            </div>
          : <span className="text-sm text-saas-muted">—</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: () => (
        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
      ),
    },
  ]

  return (
    <motion.div
      {...pageVariants}
      className="space-y-4 lg:space-y-6"
    >
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">Clientes</h1>
          {isLoading ? (
            <Skeleton className="h-4 w-24 mt-1" />
          ) : (
            <p className="text-sm text-saas-muted">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 shrink-0">
            {(['table', 'grid'] as const).map((mode) => {
              const isActive = viewMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  title={mode === 'table' ? 'Vista tabla' : 'Vista grilla'}
                  className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${
                    isActive
                      ? 'text-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="view-mode-clients"
                      className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      style={{ zIndex: 0 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center">
                    {mode === 'table' ? <LayoutList size={14} /> : <LayoutGrid size={14} />}
                  </span>
                </button>
              )
            })}
          </div>
          <button
            onClick={refetch}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-saas-border bg-white text-gray-400 transition-all hover:bg-saas-bg hover:text-gray-900 active:scale-[0.98]"
          >
            <RefreshCw size={15} />
          </button>
          {can('clients', 'create') && (
            <button
              onClick={() => navigate('/clients/new')}
              className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
                <Plus size={13} strokeWidth={2.5} />
              </span>
              Nuevo cliente
            </button>
          )}
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-6 flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="relative w-full max-w-md">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#8A8A9A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o DNI…"
            className="w-full rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl pl-10 pr-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none h-10"
          />
        </div>
        <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1 flex-wrap sm:flex-nowrap">
          {STATUS_FILTERS.map(f => {
            const isActive = statusFilter === f.value
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer flex-1 sm:flex-none ${
                  isActive
                    ? 'text-white dark:text-gray-900'
                    : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="filter-status"
                    className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ zIndex: 0 }}
                  />
                )}
                <span className="relative z-10">{f.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={refetch} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Table / Grid */}
      {viewMode === 'table' ? (
        <Table
          columns={columns}
          data={filtered}
          keyExtractor={c => c.id}
          isLoading={isLoading}
          onRowClick={c => navigate(`/clients/${c.id}`)}
          emptyMessage="No se encontraron clientes"
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl lg:rounded-[2rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No se encontraron clientes</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(c => {
            const initials = `${c.name.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase()
            const avatarColor =
              c.status === 'active'   ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
              c.status === 'expiring' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
              c.status === 'debt'     ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
                                        'bg-gray-200/60 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400'
            return (
              <button
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                className="group text-left w-full bg-white/30 dark:bg-black/30 backdrop-blur-3xl rounded-[1.75rem] border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_48px_rgba(0,0,0,0.45)] hover:bg-white/60 dark:hover:bg-black/50 hover:border-white/70 dark:hover:border-white/15"
              >
                <div className="flex flex-col gap-4">
                  {/* Top row: avatar + chevron */}
                  <div className="flex items-start justify-between">
                    <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-sm font-black ${avatarColor}`}>
                      {initials}
                    </div>
                    <ChevronRight
                      size={16}
                      className="mt-0.5 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200"
                    />
                  </div>

                  {/* Name + contact */}
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-bold text-gray-900 dark:text-white truncate leading-tight">
                      {c.name} {c.lastName}
                    </p>
                    {c.email ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                        <Mail size={11} className="shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </div>
                    ) : null}
                    {c.phone ? (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Phone size={11} className="shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-black/5 dark:border-white/[0.06]">
                    <Badge status={c.status} />
                    <div className="text-right shrink-0 min-w-0">
                      {c.planName ? (
                        <>
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{c.planName}</p>
                          {c.planFrequency && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{c.planFrequency}× / sem</p>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500">Sin plan</p>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

    </motion.div>
  )
}
