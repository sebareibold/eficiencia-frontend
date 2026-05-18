import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import { Plus, Search, RefreshCw, LayoutList, LayoutGrid, ChevronRight, Phone, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useClients } from '../hooks/useClients'
import { clientsApi } from '../api/clients.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Table, { type Column } from '../components/ui/Table'
import Skeleton from '../components/ui/Skeleton'
import type { Client } from '../types/client.types'
import type { ClientStatus } from '../constants/clientStatus'
import { ROUTES } from '../constants/routes'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  lastName: z.string().min(1, 'El apellido es requerido'),
  email: z.string().email('Email inválido').or(z.literal('')),
  phone: z.string().optional(),
  dni: z.string().min(1, 'El DNI es requerido'),
})

type FormValues = z.infer<typeof schema>

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
  const { clients, isLoading, error, refetch } = useClients()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'grid' : 'table'
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

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

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      await clientsApi.create({
        name: data.name,
        lastName: data.lastName,
        email: data.email ?? '',
        phone: data.phone ?? '',
        dni: data.dni,
      })
      addToast('Cliente creado correctamente', 'success')
      setModalOpen(false)
      reset()
      refetch()
    } catch {
      addToast('Error al crear el cliente', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

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
      className="space-y-6"
    >
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">Clientes</h1>
          {!isLoading && (
            <p className="text-sm text-saas-muted">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-xl border border-saas-border dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-xl overflow-hidden">
            <button
              onClick={() => setViewMode('table')}
              className={`flex h-9 w-9 items-center justify-center transition-all duration-200 ${viewMode === 'table' ? 'bg-gray-900 dark:bg-white/[0.12] text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              title="Vista tabla"
            >
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex h-9 w-9 items-center justify-center transition-all duration-200 ${viewMode === 'grid' ? 'bg-gray-900 dark:bg-white/[0.12] text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              title="Vista grilla"
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          <button
            onClick={refetch}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-saas-border bg-white text-gray-400 transition-all hover:bg-saas-bg hover:text-gray-900 active:scale-[0.98]"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            Nuevo cliente
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="mb-6 flex w-full flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="relative w-full max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o DNI…"
            className="w-full rounded-xl border border-saas-border bg-white py-2 pl-10 pr-4 text-sm text-gray-900 transition-all focus:border-eficiencia-yellow focus:outline-none focus:ring-2 focus:ring-eficiencia-yellow/20"
          />
        </div>
        <div className="flex flex-wrap gap-2 py-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors active:scale-[0.98] ${
                statusFilter === f.value
                  ? 'text-white'
                  : 'border border-saas-border bg-white text-gray-700 hover:bg-saas-hover'
              }`}
            >
              {statusFilter === f.value && (
                <motion.div
                  layoutId="filter-status"
                  className="absolute inset-0 rounded-full bg-gray-900"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  style={{ zIndex: 0 }}
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          ))}
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
            <Skeleton key={i} className="h-48 rounded-[2rem]" />
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

      {/* Create modal */}
      <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); reset() }} title="Nuevo cliente" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *" error={errors.name?.message} {...register('name')} />
            <Input label="Apellido *" error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <Input label="DNI *" error={errors.dni?.message} {...register('dni')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Teléfono" error={errors.phone?.message} {...register('phone')} />
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            El primer pago siempre se registra por transferencia bancaria.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setModalOpen(false); reset() }}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Crear cliente
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
