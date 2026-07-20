import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants, staggerContainerFast, fadeUpItem } from '../lib/motion'
import { Plus, Search, RefreshCw, LayoutList, LayoutGrid, ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Phone, Mail, Users, X, ArrowUpDown, UserX, SlidersHorizontal } from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays } from 'date-fns'
import { formatDate } from '../utils/formatDate'
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
type MembresiaFilter = 'all' | 'active' | 'expiring' | 'pendiente' | 'sin_membresia'
type ProporcionalFilter = 'all' | 'si' | 'no'

type AdvancedFilters = {
  conTurnos?: boolean
  frecuenciaSemanal?: '2' | '3' | 'full'
  sexo?: 'MASCULINO' | 'FEMENINO' | 'OTRO'
  edadMin?: number
  edadMax?: number
  sedeId?: string
  conCalendario?: boolean
  alturaMin?: number
  alturaMax?: number
  pesoMin?: number
  pesoMax?: number
}

const ACTIVIDAD_FILTERS: { value: ActividadFilter; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'active',   label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
]

const MEMBRESIA_FILTERS: { value: MembresiaFilter; label: string }[] = [
  { value: 'all',          label: 'Todos' },
  { value: 'active',       label: 'Activa' },
  { value: 'expiring',     label: 'Vencida' },
  { value: 'pendiente',    label: 'Programada' },
  { value: 'sin_membresia', label: 'Sin membresía' },
]

function mapMembresiaToEstadoPago(s: MembresiaFilter): string | undefined {
  if (s === 'active')        return 'AL_DIA'
  if (s === 'expiring')      return 'VENCIDO'
  if (s === 'pendiente')     return 'PENDIENTE'
  if (s === 'sin_membresia') return 'SIN_MEMBRESIA'
  return undefined
}

function estadoPagoToFilter(v: string | null): MembresiaFilter {
  if (v === 'AL_DIA')       return 'active'
  if (v === 'VENCIDO')      return 'expiring'
  if (v === 'PENDIENTE')    return 'pendiente'
  if (v === 'SIN_MEMBRESIA') return 'sin_membresia'
  return 'all'
}

type PeriodMode = 'month' | 'year' | 'historic'
type SortKey = 'createdAt' | 'nombre' | 'vencimiento' | 'estado' | 'email' | 'telefono' | 'estadoPago' | 'planName' | 'fechaInicio'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'createdAt',   label: 'Fecha de alta' },
  { value: 'nombre',      label: 'Nombre' },
  { value: 'vencimiento', label: 'Vencimiento' },
  { value: 'estado',      label: 'Actividad' },
  { value: 'telefono',    label: 'Contacto' },
  { value: 'estadoPago',  label: 'Estado membresía' },
  { value: 'planName',    label: 'Plan' },
  { value: 'fechaInicio', label: 'Inicio membresía' },
]

// Mapeo columna tabla ↔ clave backend
const COL_TO_SORT: Record<string, SortKey> = {
  name:                'nombre',
  activityStatus:      'estado',
  membershipExpiresAt: 'vencimiento',
  email:               'telefono',
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
  telefono:    'email',
  estadoPago:  'status',
  planName:    'planName',
  fechaInicio: 'membershipStartDate',
}

function fmtDate(d: string | null | undefined) {
  if (!d) return null
  try { return formatDate(d, 'dd MMM yy') } catch { return null }
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
  const [searchParams] = useSearchParams()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actividadFilter, setActividadFilter] = useState<ActividadFilter>('active')
  const [membresiaFilter, setMembresiaFilter] = useState<MembresiaFilter>(
    () => estadoPagoToFilter(searchParams.get('estadoPago'))
  )
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [advFilters, setAdvFilters] = useState<AdvancedFilters>({})
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [drawerTop, setDrawerTop] = useState(200)
  const [drawerRight, setDrawerRight] = useState(16)
  const filterBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    configuracionSistemaApi.get().then(c => setDiasGracia(c.diasGraciaInactivacion)).catch(() => {})
    clientsApi.getSedes().then(setSedes).catch(() => {})
  }, [])

  useEffect(() => {
    if (drawerOpen && filterBtnRef.current) {
      const rect = filterBtnRef.current.getBoundingClientRect()
      setDrawerTop(rect.bottom + 10)
      setDrawerRight(window.innerWidth - rect.right)
    }
  }, [drawerOpen])

  const activeAdvFiltersCount = [
    advFilters.conTurnos !== undefined,
    advFilters.frecuenciaSemanal !== undefined,
    advFilters.sexo !== undefined,
    advFilters.edadMin !== undefined || advFilters.edadMax !== undefined,
    advFilters.sedeId !== undefined,
    advFilters.conCalendario !== undefined,
    advFilters.alturaMin !== undefined || advFilters.alturaMax !== undefined,
    advFilters.pesoMin !== undefined || advFilters.pesoMax !== undefined,
    proporcionalFilter !== 'all',
  ].filter(Boolean).length

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
    ...advFilters,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { goToPage(1) }, [debouncedSearch, actividadFilter, membresiaFilter, periodMode, proporcionalFilter, JSON.stringify(advFilters)])

  // Limpiar selección al cambiar filtros o página
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedIds(new Set()) }, [debouncedSearch, actividadFilter, membresiaFilter, periodMode, currentPage, proporcionalFilter, JSON.stringify(advFilters)])

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
        ...advFilters,
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
      render: (c) => {
        const buildWaLink = (phone: string, nombre: string, display: string) => {
          const digits = phone.replace(/\D/g, '')
          const waNumber = digits.startsWith('549') ? digits : '54' + digits
          const mensaje = encodeURIComponent('Hola ' + nombre + '! C\u00f3mo est\u00e1s? Te contactamos desde Eficiencia.')
          return (
            <a
              href={`https://wa.me/${waNumber}?text=${mensaje}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-green-500 hover:text-green-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              {display}
            </a>
          )
        }
        if (c.esMenor && c.responsableContacto)
          return buildWaLink(c.responsableContacto, c.responsableNombre || 'buen d\u00eda', c.responsableContacto)
        if (c.phone)
          return buildWaLink(c.phone, c.name, c.phone)
        return <span className="text-sm text-saas-muted">{c.email || '—'}</span>
      },
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
      header: 'Inicio membresía',
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
        <div className="relative w-full max-w-xs shrink-0">
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

          {/* Botón filtros avanzados */}
          <div className="flex items-end">
            <button
              ref={filterBtnRef}
              onClick={() => setDrawerOpen(o => !o)}
              title="Filtros avanzados"
              className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                drawerOpen || activeAdvFiltersCount > 0
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.18)]'
                  : 'border border-dashed border-gray-300 dark:border-gray-700 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              <SlidersHorizontal size={14} />
              {activeAdvFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-black text-gray-900 shadow-sm">
                  {activeAdvFiltersCount}
                </span>
              )}
            </button>
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

    {/* Panel de filtros avanzados — flotante, emerge del botón trigger */}
    <AnimatePresence>
      {drawerOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -6, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          style={{ top: drawerTop, right: drawerRight, transformOrigin: 'top right' }}
          className="fixed z-[100] w-[44rem] flex flex-col rounded-2xl border border-saas-border dark:border-white/[0.08] bg-saas-bg/90 dark:bg-[#111111]/95 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.08),0_32px_80px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_32px_80px_rgba(0,0,0,0.55)] overflow-hidden max-h-[calc(100vh-12rem)]"
        >
          {/* Grilla de puntos — idéntica al fondo de la página */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.07] px-4 py-3 shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={13} className="text-gray-400 dark:text-gray-500" />
              <span className="text-xs font-bold tracking-tight text-gray-900 dark:text-white">Filtros avanzados</span>
              {activeAdvFiltersCount > 0 && (
                <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[9px] font-black text-gray-900">
                  {activeAdvFiltersCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">

              {/* Turnos activos */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Turnos</h3>
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setAdvFilters(f => ({ ...f, conTurnos: f.conTurnos ? undefined : true }))}
                >
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${advFilters.conTurnos ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-gray-900 shadow transition-transform duration-200 ${advFilters.conTurnos ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Con turnos</span>
                </div>
              </section>

              {/* Calendario deportivo */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Calendario</h3>
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setAdvFilters(f => ({ ...f, conCalendario: f.conCalendario ? undefined : true }))}
                >
                  <div className={`relative h-5 w-9 rounded-full transition-colors ${advFilters.conCalendario ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                    <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-gray-900 shadow transition-transform duration-200 ${advFilters.conCalendario ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Con eventos</span>
                </div>
              </section>

              {/* Frecuencia semanal */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Frecuencia semanal</h3>
                <div className="flex flex-wrap gap-1.5">
                  {([['2', '2× / sem'], ['3', '3× / sem'], ['full', 'Full (4-5×)']] as ['2' | '3' | 'full', string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setAdvFilters(f => ({ ...f, frecuenciaSemanal: f.frecuenciaSemanal === val ? undefined : val }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        advFilters.frecuenciaSemanal === val
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                          : 'border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Sexo */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Sexo</h3>
                <div className="flex flex-wrap gap-1.5">
                  {([['MASCULINO', 'Masculino'], ['FEMENINO', 'Femenino'], ['OTRO', 'Otro']] as ['MASCULINO' | 'FEMENINO' | 'OTRO', string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setAdvFilters(f => ({ ...f, sexo: f.sexo === val ? undefined : val }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        advFilters.sexo === val
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                          : 'border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Proporcional */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Con proporcional</h3>
                <div className="flex flex-wrap gap-1.5">
                  {([['all', 'Todos'], ['si', 'Sí'], ['no', 'No']] as [ProporcionalFilter, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setProporcionalFilter(val)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        proporcionalFilter === val
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                          : 'border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Edad */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Edad</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Mín"
                    min={0}
                    max={120}
                    value={advFilters.edadMin ?? ''}
                    onChange={e => setAdvFilters(f => ({ ...f, edadMin: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-16 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                  />
                  <span className="text-xs text-gray-400">—</span>
                  <input
                    type="number"
                    placeholder="Máx"
                    min={0}
                    max={120}
                    value={advFilters.edadMax ?? ''}
                    onChange={e => setAdvFilters(f => ({ ...f, edadMax: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-16 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                  />
                  <span className="text-xs text-gray-400 shrink-0">años</span>
                </div>
              </section>

              {/* Altura */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Altura</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Mín"
                    value={advFilters.alturaMin ?? ''}
                    onChange={e => setAdvFilters(f => ({ ...f, alturaMin: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-16 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                  />
                  <span className="text-xs text-gray-400">—</span>
                  <input
                    type="number"
                    placeholder="Máx"
                    value={advFilters.alturaMax ?? ''}
                    onChange={e => setAdvFilters(f => ({ ...f, alturaMax: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-16 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                  />
                  <span className="text-xs text-gray-400 shrink-0">cm</span>
                </div>
              </section>

              {/* Peso */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Peso</h3>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Mín"
                    value={advFilters.pesoMin ?? ''}
                    onChange={e => setAdvFilters(f => ({ ...f, pesoMin: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-16 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                  />
                  <span className="text-xs text-gray-400">—</span>
                  <input
                    type="number"
                    placeholder="Máx"
                    value={advFilters.pesoMax ?? ''}
                    onChange={e => setAdvFilters(f => ({ ...f, pesoMax: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-16 rounded-xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl px-2 py-1.5 text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-white/20"
                  />
                  <span className="text-xs text-gray-400 shrink-0">kg</span>
                </div>
              </section>

              {/* Sede */}
              {sedes.length > 0 && (
                <section className="col-span-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2.5">Sede</h3>
                  <div className="flex flex-wrap gap-2">
                    {sedes.map(sede => (
                      <button
                        key={sede.id}
                        onClick={() => setAdvFilters(f => ({ ...f, sedeId: f.sedeId === sede.id ? undefined : sede.id }))}
                        className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                          advFilters.sedeId === sede.id
                            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                            : 'border border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {sede.nombre}
                      </button>
                    ))}
                  </div>
                </section>
              )}

            </div>
          </div>

          {/* Footer — limpiar filtros */}
          {activeAdvFiltersCount > 0 && (
            <div className="shrink-0 border-t border-black/[0.06] dark:border-white/[0.07] px-4 py-3">
              <button
                onClick={() => { setAdvFilters({}); setProporcionalFilter('all') }}
                className="w-full rounded-xl border border-dashed border-gray-200 dark:border-gray-700/70 py-2 text-[11px] font-bold text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-150 cursor-pointer active:scale-[0.98]"
              >
                Limpiar filtros avanzados
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>

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
