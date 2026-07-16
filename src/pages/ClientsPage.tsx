import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, staggerContainerFast, fadeUpItem } from '../lib/motion'
import { Plus, Search, RefreshCw, LayoutList, LayoutGrid, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Phone, Mail, Users, X, ArrowUpDown, UserX } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePermissions } from '../hooks/usePermissions'
import { useClients } from '../hooks/useClients'
import { useUiStore } from '../store/uiStore'
import { clientsApi } from '../api/clients.api'
import { configuracionSistemaApi } from '../api/configuracion-sistema.api'
import Badge from '../components/ui/Badge'
import Table, { type Column } from '../components/ui/Table'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { Client } from '../types/client.types'

type ActividadFilter = 'all' | 'active' | 'inactive'
type MembresiaFilter = 'all' | 'active' | 'expiring'
type ProporcionalFilter = 'all' | 'si' | 'no'

const ACTIVIDAD_FILTERS: { value: ActividadFilter; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'active',   label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
]

const MEMBRESIA_FILTERS: { value: MembresiaFilter; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'active',   label: 'Al día' },
  { value: 'expiring', label: 'Vencida' },
]

function mapMembresiaToEstadoPago(s: MembresiaFilter): string | undefined {
  if (s === 'active')   return 'AL_DIA'
  if (s === 'expiring') return 'VENCIDO'
  return undefined
}

type PeriodMode = 'month' | 'year' | 'historic'
type SortKey = 'createdAt' | 'nombre' | 'vencimiento' | 'estado' | 'email' | 'estadoPago' | 'planName' | 'fechaInicio'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'createdAt',   label: 'Fecha de alta' },
  { value: 'nombre',      label: 'Nombre' },
  { value: 'vencimiento', label: 'Vencimiento' },
  { value: 'estado',      label: 'Actividad' },
  { value: 'email',       label: 'Email' },
  { value: 'estadoPago',  label: 'Estado membresía' },
  { value: 'planName',    label: 'Plan' },
  { value: 'fechaInicio', label: 'Inicio membresía' },
]

// Mapeo columna tabla ↔ clave backend
const COL_TO_SORT: Record<string, SortKey> = {
  name:                'nombre',
  activityStatus:      'estado',
  membershipExpiresAt: 'vencimiento',
  email:               'email',
  status:              'estadoPago',
  planName:            'planName',
  membershipStartDate: 'fechaInicio',
}

const SORT_TO_COL: Record<SortKey, string> = {
  nombre:      'name',
  estado:      'activityStatus',
  vencimiento: 'membershipExpiresAt',
  createdAt:   '',
  email:       'email',
  estadoPago:  'status',
  planName:    'planName',
  fechaInicio: 'membershipStartDate',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null
  try { return format(new Date(d), 'dd MMM yy', { locale: es }) } catch { return null }
}

function vencimientoColor(d: string | null | undefined) {
  if (!d) return 'text-gray-400 dark:text-gray-600'
  const diff = differenceInDays(new Date(d), new Date())
  if (diff < 0)   return 'text-red-500 dark:text-red-400'
  if (diff <= 7)  return 'text-red-400'
  if (diff <= 30) return 'text-orange-400'
  return 'text-gray-700 dark:text-gray-300'
}

const MODALIDAD_LABEL: Record<string, string> = {
  MENSUAL: 'Mensual',
  TRES_MESES: '3 meses',
  SEIS_MESES: '6 meses',
  TRANSFERENCIA_MENSUAL: 'Transf.',
  EFECTIVO: 'Efectivo',
  MEMBRESIA_3_MESES: '3 meses',
  MEMBRESIA_6_MESES: '6 meses',
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const { can } = usePermissions()
  const addToast = useUiStore(s => s.addToast)
  const today = new Date()

  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  )
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actividadFilter, setActividadFilter] = useState<ActividadFilter>('active')
  const [membresiaFilter, setMembresiaFilter] = useState<MembresiaFilter>('all')
  const [proporcionalFilter, setProporcionalFilter] = useState<ProporcionalFilter>('all')
  const [periodMode, setPeriodMode] = useState<PeriodMode>('historic')
  const [navDate, setNavDate] = useState(today)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [bulkTotal, setBulkTotal] = useState(0)
  const [isSelectingAll, setIsSelectingAll] = useState(false)
  const [sortKey, setSortKey]   = useState<SortKey>('createdAt')
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc')
  const [inactivarTarget, setInactivarTarget] = useState<Client | null>(null)
  const [inactivarLoading, setInactivarLoading] = useState(false)
  const [diasGracia, setDiasGracia] = useState(10)

  useEffect(() => {
    configuracionSistemaApi.get().then(c => setDiasGracia(c.diasGraciaInactivacion)).catch(() => {})
  }, [])

  // Debounce search para no disparar una query por cada tecla
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const desde = periodMode === 'month'
    ? format(startOfMonth(navDate), 'yyyy-MM-dd')
    : periodMode === 'year'
    ? `${navDate.getFullYear()}-01-01`
    : undefined

  const hasta = periodMode === 'month'
    ? format(endOfMonth(navDate), 'yyyy-MM-dd')
    : periodMode === 'year'
    ? `${navDate.getFullYear()}-12-31`
    : undefined

  const periodLabel = periodMode === 'month'
    ? format(navDate, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase())
    : periodMode === 'year'
    ? String(navDate.getFullYear())
    : 'Todo el tiempo'

  const isAtPresent = periodMode === 'month'
    ? navDate >= startOfMonth(today)
    : navDate.getFullYear() >= today.getFullYear()

  const goBack = () => setNavDate(prev =>
    periodMode === 'month' ? subMonths(prev, 1) : new Date(prev.getFullYear() - 1, 0, 1)
  )
  const goForward = () => setNavDate(prev =>
    periodMode === 'month' ? addMonths(prev, 1) : new Date(prev.getFullYear() + 1, 0, 1)
  )

  const { clients, total, totalPages, currentPage, goToPage, isLoading, error, refetch } = useClients({
    search: debouncedSearch || undefined,
    estado:     actividadFilter === 'inactive' ? 'INACTIVO' : actividadFilter === 'active' ? 'ACTIVO' : undefined,
    estadoPago: mapMembresiaToEstadoPago(membresiaFilter),
    desde,
    hasta,
    sortBy:  sortKey,
    sortDir: sortDir,
    proporcionalPendiente: proporcionalFilter === 'si' ? true : proporcionalFilter === 'no' ? false : undefined,
  })

  function handleSort(colKey: string) {
    const backendKey = COL_TO_SORT[colKey]
    if (!backendKey) return
    if (sortKey === backendKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(backendKey)
      setSortDir('asc')
    }
    goToPage(1)
  }

  // Resetear página al cambiar filtros
  useEffect(() => { goToPage(1) }, [debouncedSearch, actividadFilter, membresiaFilter, periodMode, proporcionalFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar selección al cambiar filtros o página
  useEffect(() => { setSelectedIds(new Set()) }, [debouncedSearch, actividadFilter, membresiaFilter, periodMode, currentPage, proporcionalFilter])

  const isAllSelected = clients.length > 0 && clients.every(c => selectedIds.has(c.id))
  const isIndeterminate = !isAllSelected && clients.some(c => selectedIds.has(c.id))

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (isAllSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        clients.forEach(c => next.delete(c.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        clients.forEach(c => next.add(c.id))
        return next
      })
    }
  }

  async function handleSelectAllPages() {
    setIsSelectingAll(true)
    try {
      const result = await clientsApi.getAll({
        search: debouncedSearch || undefined,
        estado: actividadFilter === 'inactive' ? 'INACTIVO' : actividadFilter === 'active' ? 'ACTIVO' : undefined,
        estadoPago: mapMembresiaToEstadoPago(membresiaFilter),
        desde,
        hasta,
        limit: total,
        page: 1,
      })
      setSelectedIds(new Set(result.data.map(c => c.id)))
    } catch {
      addToast('Error al cargar clientes', 'error')
    } finally {
      setIsSelectingAll(false)
    }
  }

  async function handleInactivarCliente() {
    if (!inactivarTarget) return
    setInactivarLoading(true)
    try {
      await clientsApi.update(inactivarTarget.id, { estado: 'INACTIVO' })
      setInactivarTarget(null)
      addToast('Cliente inactivado y dado de baja de sus turnos', 'success')
      refetch()
    } catch {
      addToast('Error al inactivar el cliente', 'error')
    } finally {
      setInactivarLoading(false)
    }
  }

  async function handleBulkAction(estado: 'ACTIVO' | 'INACTIVO') {
    if (isBulkLoading) return
    const ids = [...selectedIds]
    setBulkTotal(ids.length)
    setBulkProgress(0)
    setIsBulkLoading(true)
    try {
      const result = await clientsApi.bulkUpdateEstado(ids, estado)
      setBulkProgress(result.updated)
      await refetch()
      setSelectedIds(new Set())
      addToast(`${result.updated} cliente${result.updated !== 1 ? 's' : ''} actualizado${result.updated !== 1 ? 's' : ''}`, 'success')
    } catch {
      addToast('Error al actualizar clientes', 'error')
    } finally {
      setIsBulkLoading(false)
      setBulkProgress(0)
      setBulkTotal(0)
    }
  }

  const isAdmin = can('clients', 'delete')

  const columns: Column<Client>[] = [
    ...(isAdmin ? [{
      key: 'select',
      header: (
        <div
          onClick={e => { e.stopPropagation(); toggleSelectAll() }}
          className={`h-4 w-4 rounded cursor-pointer border-2 flex items-center justify-center transition-colors ${
            isAllSelected
              ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
              : isIndeterminate
              ? 'bg-gray-400 dark:bg-gray-500 border-gray-400 dark:border-gray-500'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
          }`}
        >
          {isAllSelected && <div className="h-2 w-2 rounded-full bg-white dark:bg-gray-900" />}
          {isIndeterminate && <div className="h-0.5 w-2 rounded-full bg-white dark:bg-gray-900" />}
        </div>
      ),
      render: (c: Client) => (
        <div
          onClick={e => { e.stopPropagation(); toggleSelect(c.id) }}
          className={`h-4 w-4 rounded cursor-pointer border-2 flex items-center justify-center transition-colors ${
            selectedIds.has(c.id)
              ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
          }`}
        >
          {selectedIds.has(c.id) && <div className="h-2 w-2 rounded-full bg-white dark:bg-gray-900" />}
        </div>
      ),
    } as Column<Client>] : []),
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900 dark:text-white">{c.name} {c.lastName}</span>
          {c.cuil && <span className="text-xs text-saas-muted">CUIL {c.cuil}</span>}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contacto',
      sortable: true,
      render: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-saas-muted">{c.email || '—'}</span>
          {c.phone && <span className="text-xs text-saas-muted">{c.phone}</span>}
        </div>
      ),
    },
    {
      key: 'activityStatus',
      header: 'Actividad',
      sortable: true,
      render: (c) => (
        c.activityStatus === 'inactive'
          ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              INACTIVO
            </span>
          : <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              ACTIVO
            </span>
      ),
    },
    {
      key: 'status',
      header: 'Estado membresía',
      sortable: true,
      render: (c) => {
        if (c.activityStatus === 'inactive') return <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
        if (c.status === 'expiring' && c.membershipExpiresAt) {
          const exp = new Date(c.membershipExpiresAt)
          const daysLate = Math.ceil((Date.now() - exp.getTime()) / 86_400_000)
          if (daysLate > 0) {
            const inicioMesSig = new Date(exp.getFullYear(), exp.getMonth() + 1, 1)
            const fechaInac = new Date(inicioMesSig)
            fechaInac.setDate(fechaInac.getDate() + diasGracia)
            const yaPaso = new Date() >= fechaInac
            const hint = yaPaso
              ? 'Pendiente de inactivación automática'
              : `Se inactiva el ${format(fechaInac, 'd/MM', { locale: es })} si no renueva`
            return (
              <div className="group relative inline-flex flex-col gap-0.5">
                <Badge status={c.status} />
                <span className="text-[9px] font-semibold text-orange-500 dark:text-orange-400 leading-tight">{hint}</span>
              </div>
            )
          }
        }
        return <Badge status={c.status} />
      },
    },
    {
      key: 'planName',
      header: 'Plan',
      sortable: true,
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
      key: 'proporcional',
      header: 'Proporcional',
      render: (c) => (
        c.proporcionalPendiente
          ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
              % {c.descuentoProporcional ? `$${c.descuentoProporcional.toLocaleString('es-AR')} off` : 'Sí'}
            </span>
          : <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
      ),
    },
    {
      key: 'membershipStartDate',
      header: 'Inicio',
      sortable: true,
      render: (c) => {
        const d = fmtDate(c.membershipStartDate)
        return <span className="text-sm text-gray-600 dark:text-gray-400">{d ?? '—'}</span>
      },
    },
    {
      key: 'membershipExpiresAt',
      header: 'Vencimiento',
      sortable: true,
      render: (c) => {
        const d = fmtDate(c.membershipExpiresAt)
        return <span className={`text-sm font-semibold ${vencimientoColor(c.membershipExpiresAt)}`}>{d ?? '—'}</span>
      },
    },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex items-center gap-1.5 justify-end">
          {c.activityStatus === 'active' && can('clients', 'update') && (
            <button
              onClick={e => { e.stopPropagation(); setInactivarTarget(c) }}
              title="Inactivar cliente"
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
            >
              <UserX size={11} /> Inactivar
            </button>
          )}
          <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
        </div>
      ),
    },
  ]

  return (
    <>
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
            <p className="text-sm text-saas-muted">{total} resultado{total !== 1 ? 's' : ''}</p>
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
                    <motion.div layoutId="clients-view-pill" className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />
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

      {/* Period filter */}
      {/* Search + Filtros — misma fila */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        {/* Búsqueda */}
        <div className="relative w-full max-w-md shrink-0">
          <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 z-10 text-gray-400 dark:text-[#8A8A9A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o apellido…"
            className="w-full rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl pl-10 pr-4 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none h-10"
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          {/* Período */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Período</span>
            <div className="flex items-center gap-2">
              {periodMode !== 'historic' && (
                <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                  <button onClick={goBack} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all cursor-pointer">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2 text-xs font-bold tracking-tight text-gray-800 dark:text-gray-200 tabular-nums whitespace-nowrap">
                    {periodLabel}
                  </span>
                  <button onClick={goForward} disabled={isAtPresent} className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
              <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
                {([['historic', 'Histórico'], ['year', 'Año'], ['month', 'Mes']] as [PeriodMode, string][]).map(([mode, label]) => {
                  const isActive = periodMode === mode
                  return (
                    <button key={mode} onClick={() => { setPeriodMode(mode); setNavDate(today) }}
                      className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                    >
                      {isActive && <motion.div layoutId="clients-period-pill" className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />}
                      <span className="relative z-10">{label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Actividad */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Actividad</span>
            <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
              {ACTIVIDAD_FILTERS.map(f => {
                const isActive = actividadFilter === f.value
                return (
                  <button key={f.value} onClick={() => setActividadFilter(f.value)}
                    className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                    <span className="relative z-10">{f.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Estado membresía */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Estado membresía</span>
            <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
              {MEMBRESIA_FILTERS.map(f => {
                const isActive = membresiaFilter === f.value
                return (
                  <button key={f.value} onClick={() => setMembresiaFilter(f.value)}
                    className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                    <span className="relative z-10">{f.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Con proporcional */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">Con proporcional</span>
            <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 shadow-sm gap-1">
              {([['all', 'Todos'], ['si', 'Sí'], ['no', 'No']] as [ProporcionalFilter, string][]).map(([val, label]) => {
                const isActive = proporcionalFilter === val
                return (
                  <button key={val} onClick={() => setProporcionalFilter(val)}
                    className={`relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-300 cursor-pointer ${isActive ? 'text-white dark:text-gray-900' : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    {isActive && <div className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" style={{ zIndex: 0 }} />}
                    <span className="relative z-10">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
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

      {/* Select all pages banner */}
      {total > clients.length && isAllSelected && selectedIds.size < total && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">
          Los <strong>{clients.length}</strong> clientes de esta página están seleccionados.
          <button
            onClick={handleSelectAllPages}
            disabled={isSelectingAll}
            className="font-bold text-primary hover:underline disabled:opacity-50 ml-1"
          >
            {isSelectingAll ? 'Cargando…' : `Seleccionar los ${total} en total →`}
          </button>
        </div>
      )}
      {total > clients.length && selectedIds.size === total && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-gray-700 dark:text-gray-300">
          <strong>Los {total} clientes</strong> están seleccionados.
          <button
            onClick={() => setSelectedIds(new Set())}
            className="font-bold text-primary hover:underline ml-1"
          >
            Cancelar selección
          </button>
        </div>
      )}

      {/* Sort selector — solo en vista grid */}
      {viewMode === 'grid' && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            <ArrowUpDown size={11} /> Ordenar
          </span>
          <div className="flex flex-wrap gap-1">
            {SORT_OPTIONS.map(opt => {
              const isActive = sortKey === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (isActive) {
                      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortKey(opt.value)
                      setSortDir(opt.value === 'nombre' ? 'asc' : 'desc')
                    }
                    goToPage(1)
                  }}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-white/[0.04] text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                  {isActive && (
                    <span className="text-[9px] opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Table / Grid */}
      {viewMode === 'table' ? (
        <Table
          columns={columns}
          data={clients}
          keyExtractor={c => c.id}
          isLoading={isLoading}
          sortKey={SORT_TO_COL[sortKey] || undefined}
          sortDir={sortDir}
          onSort={handleSort}
          onRowClick={c => navigate(`/clients/${c.id}`)}
          emptyMessage="No se encontraron clientes"
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl lg:rounded-[2rem]" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No se encontraron clientes</p>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={staggerContainerFast}
          initial="initial"
          animate="animate"
        >
          {clients.map(c => {
            const initials = `${c.name.charAt(0)}${c.lastName.charAt(0)}`.toUpperCase()
            const avatarColor =
              c.status === 'active'   ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
              c.status === 'expiring' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
              c.status === 'debt'     ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                                        'bg-gray-200/60 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400'
            return (
              <motion.button
                key={c.id}
                variants={fadeUpItem}
                onClick={() => navigate(`/clients/${c.id}`)}
                whileHover={{ y: -4, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                whileTap={{ scale: 0.97, y: 0, transition: { duration: 0.1 } }}
                className="group text-left w-full bg-white/30 dark:bg-black/30 backdrop-blur-3xl rounded-[1.75rem] border border-white/50 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-5 transition-[box-shadow,background-color,border-color] duration-250 hover:shadow-[0_20px_48px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_20px_48px_rgba(0,0,0,0.45)] hover:bg-white/60 dark:hover:bg-black/50 hover:border-white/70 dark:hover:border-white/15"
              >
                <div className="flex flex-col gap-4">
                  {/* Top row: avatar + chevron */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {isAdmin && (
                        <div
                          onClick={e => { e.stopPropagation(); toggleSelect(c.id) }}
                          className={`mt-0.5 h-4 w-4 rounded cursor-pointer border-2 flex items-center justify-center transition-colors shrink-0 ${
                            selectedIds.has(c.id)
                              ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white'
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-500 dark:hover:border-gray-400'
                          }`}
                        >
                          {selectedIds.has(c.id) && <div className="h-2 w-2 rounded-full bg-white dark:bg-gray-900" />}
                        </div>
                      )}
                      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-sm font-black ${avatarColor}`}>
                        {initials}
                      </div>
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
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.activityStatus === 'inactive' ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                          INACTIVO
                        </span>
                      ) : (
                        <Badge status={c.status} />
                      )}
                      {c.proporcionalPendiente && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          % {c.descuentoProporcional ? `$${c.descuentoProporcional.toLocaleString('es-AR')} off` : 'Proporcional'}
                        </span>
                      )}
                    </div>
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
              </motion.button>
            )
          })}
        </motion.div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
            Página {currentPage} de {totalPages} · {total} clientes en total
          </span>
          <div className="flex items-center rounded-full border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl p-1 gap-1">
            {/* Primera página */}
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronsLeft size={14} />
            </button>
            {/* Anterior */}
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Números con ellipsis */}
            {(() => {
              const items: (number | null)[] = []
              if (totalPages <= 7) {
                for (let p = 1; p <= totalPages; p++) items.push(p)
              } else {
                items.push(1)
                if (currentPage > 3) items.push(null)
                const lo = Math.max(2, currentPage - 1)
                const hi = Math.min(totalPages - 1, currentPage + 1)
                for (let p = lo; p <= hi; p++) items.push(p)
                if (currentPage < totalPages - 2) items.push(null)
                items.push(totalPages)
              }
              return items.map((pg, i) =>
                pg === null ? (
                  <span key={`el-${i}`} className="flex h-7 w-5 items-end justify-center pb-0.5 text-xs text-gray-400 dark:text-gray-600 select-none">…</span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => goToPage(pg)}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all cursor-pointer ${
                      pg === currentPage
                        ? 'text-white dark:text-gray-900'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    {pg === currentPage && (
                      <motion.div layoutId="clients-page-pill" className="absolute inset-0 rounded-full bg-gray-900 dark:bg-white" style={{ zIndex: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }} />
                    )}
                    <span className="relative z-10">{pg}</span>
                  </button>
                )
              )
            })()}

            {/* Siguiente */}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
            {/* Última página */}
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/40 dark:hover:bg-white/[0.05] transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      <AnimatePresence>
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-2xl border border-white/30 dark:border-white/10 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden whitespace-nowrap">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2 pr-3 border-r border-gray-200 dark:border-white/10">
              <Users size={14} className="text-gray-500 dark:text-gray-400 shrink-0" />
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                {isBulkLoading
                  ? `${bulkProgress} / ${bulkTotal}`
                  : `${selectedIds.size} seleccionado${selectedIds.size !== 1 ? 's' : ''}`
                }
              </span>
            </div>
            {isBulkLoading ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">Actualizando…</span>
            ) : (
              <>
                <button
                  onClick={() => handleBulkAction('ACTIVO')}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                >
                  Marcar activos
                </button>
                <button
                  onClick={() => handleBulkAction('INACTIVO')}
                  className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700/60 transition-colors"
                >
                  Marcar inactivos
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
          {/* Progress bar */}
          {isBulkLoading && (
            <div className="h-1 bg-gray-100 dark:bg-white/[0.05] overflow-hidden">
              <motion.div
                className="h-full w-full bg-primary"
                style={{ transformOrigin: 'left' }}
                animate={{ scaleX: bulkTotal > 0 ? bulkProgress / bulkTotal : 0 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
              />
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>

    <ConfirmDialog
      isOpen={inactivarTarget !== null}
      title="Inactivar cliente"
      message={
        inactivarTarget
          ? inactivarTarget.turnosActivosCount > 0
            ? `¿Marcás a ${inactivarTarget.name} ${inactivarTarget.lastName} como inactivo? Se lo dará de baja de ${inactivarTarget.turnosActivosCount} turno${inactivarTarget.turnosActivosCount !== 1 ? 's' : ''} activo${inactivarTarget.turnosActivosCount !== 1 ? 's' : ''} y los cupos quedarán liberados.`
            : `¿Marcás a ${inactivarTarget.name} ${inactivarTarget.lastName} como inactivo?`
          : ''
      }
      warning={inactivarTarget && inactivarTarget.turnosActivosCount > 0 ? 'El cliente deberá reinscribirse manualmente si se reactiva.' : undefined}
      confirmLabel="Inactivar"
      isLoading={inactivarLoading}
      onConfirm={handleInactivarCliente}
      onClose={() => setInactivarTarget(null)}
    />
    </>
  )
}
