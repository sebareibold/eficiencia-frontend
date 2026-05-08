import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Phone, Mail, CalendarDays, CheckCircle2, XCircle,
  Edit2, CreditCard, Activity, Clock, Hash, Banknote, ArrowLeftRight,
  MessageCircle, Tag, Dumbbell, TrendingUp,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clientsApi } from '../api/clients.api'
import { attendanceApi } from '../api/attendance.api'
import { paymentsApi } from '../api/payments.api'
import { useUiStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Skeleton from '../components/ui/Skeleton'
import { formatDate } from '../utils/formatDate'
import { formatCurrency } from '../utils/formatCurrency'
import type { Client } from '../types/client.types'
import type { Payment } from '../types/payment.types'
import type { AttendanceRecord } from '../types/attendance.types'

// ─── Configuración de métodos de pago ─────────────────────────────────────────
const METHOD_CONFIG: Record<string, { label: string; Icon: typeof Banknote; color: string; bg: string }> = {
  cash:     { label: 'Efectivo',       Icon: Banknote,       color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  transfer: { label: 'Transferencia',  Icon: ArrowLeftRight, color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/10'    },
  card:     { label: 'Débito',         Icon: CreditCard,     color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10'  },
}

// ─── Schema edición ────────────────────────────────────────────────────────────
const editSchema = z.object({
  name:      z.string().min(1, 'Requerido'),
  lastName:  z.string().min(1, 'Requerido'),
  email:     z.string().email('Email inválido').or(z.literal('')),
  phone:     z.string().optional(),
  dni:       z.string().min(1, 'Requerido'),
})
type EditValues = z.infer<typeof editSchema>
type Tab = 'pagos' | 'asistencia' | 'turnos'

// ─── Helpers visuales ─────────────────────────────────────────────────────────
function avatarColors(status: Client['status']) {
  if (status === 'active')   return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (status === 'expiring') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  if (status === 'debt')     return 'bg-red-500/15 text-red-600 dark:text-red-400'
  return 'bg-gray-200/60 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400'
}

function statusBarColor(status: Client['status']) {
  if (status === 'active')   return 'bg-emerald-500'
  if (status === 'expiring') return 'bg-amber-500'
  if (status === 'debt')     return 'bg-red-500'
  return 'bg-gray-400'
}

function membershipDaysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
}

// ─── Glassmorphism card ───────────────────────────────────────────────────────
const glassCard = 'rounded-3xl border border-white/50 dark:border-white/[0.08] bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.25)]'

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-3xl" />
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    </div>
  )
}

// ─── Chip de contacto ─────────────────────────────────────────────────────────
function ContactChip({ icon: Icon, label, href }: { icon: typeof Mail; label: string; href?: string }) {
  const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors'
  const content = (
    <>
      <Icon size={11} className="shrink-0 opacity-60" />
      <span className="truncate max-w-[200px]">{label}</span>
    </>
  )
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
         className={`${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20`}>
        {content}
        <MessageCircle size={10} className="opacity-50" />
      </a>
    )
  }
  return (
    <span className={`${base} bg-white/[0.05] dark:bg-white/[0.04] text-gray-700 dark:text-gray-400 border-gray-200 dark:border-white/[0.08]`}>
      {content}
    </span>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, message }: { icon: typeof Tag; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] dark:bg-white/[0.04] border border-white/[0.08]">
        <Icon size={20} className="text-[#8A8A9A]" />
      </div>
      <p className="text-sm text-[#8A8A9A]">{message}</p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const addToast = useUiStore(s => s.addToast)
  const user = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const [client, setClient]       = useState<Client | null>(null)
  const [payments, setPayments]   = useState<Payment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('pagos')
  const [editOpen, setEditOpen]   = useState(false)
  const [isSaving, setIsSaving]   = useState(false)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.allSettled([
      clientsApi.getById(id),
      paymentsApi.getAll({ clientId: id }),
      attendanceApi.getByClient(id),
    ]).then(([clientRes, paymentsRes, attendanceRes]) => {
      if (clientRes.status === 'fulfilled') {
        const c = clientRes.value
        setClient(c)
        reset({ name: c.name, lastName: c.lastName, email: c.email ?? '', phone: c.phone ?? '', dni: c.dni ?? '' })
      } else {
        addToast('Error al cargar el perfil', 'error')
      }
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value)
      if (attendanceRes.status === 'fulfilled') setAttendance(attendanceRes.value)
    }).finally(() => setLoading(false))
  }, [id])

  async function onEdit(data: EditValues) {
    if (!client) return
    setIsSaving(true)
    try {
      const updated = await clientsApi.update(client.id, {
        name: data.name, lastName: data.lastName,
        email: data.email ?? '', phone: data.phone ?? '', dni: data.dni,
      })
      setClient(updated)
      addToast('Cliente actualizado', 'success')
      setEditOpen(false)
    } catch {
      addToast('Error al actualizar el cliente', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Datos derivados ────────────────────────────────────────────────────────
  const totalPaid   = useMemo(() => payments.reduce((s, p) => s + p.amount, 0), [payments])
  const presentDays = useMemo(() => attendance.filter(a => a.present).length, [attendance])
  const lastVisit   = useMemo(() => {
    const sorted = attendance.filter(a => a.present).sort((a, b) => b.date.localeCompare(a.date))
    return sorted[0]?.date ?? null
  }, [attendance])

  const shiftStats = useMemo(() => {
    const map = new Map<string | number, { present: number; total: number; lastDate: string }>()
    attendance.forEach(a => {
      const cur = map.get(a.shiftId) ?? { present: 0, total: 0, lastDate: '' }
      map.set(a.shiftId, {
        total: cur.total + 1,
        present: cur.present + (a.present ? 1 : 0),
        lastDate: a.date > cur.lastDate ? a.date : cur.lastDate,
      })
    })
    return Array.from(map.entries())
      .map(([shiftId, s]) => ({ shiftId, ...s }))
      .sort((a, b) => b.present - a.present)
  }, [attendance])

  // ─── Guards ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-[#8A8A9A]">
        <p className="text-sm">Cliente no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/clients')}>
          <ArrowLeft size={15} /> Volver
        </Button>
      </div>
    )
  }

  const initials       = `${client.name.charAt(0)}${client.lastName.charAt(0)}`.toUpperCase()
  const daysLeft       = membershipDaysLeft(client.membershipExpiresAt)
  const expiryColor    = daysLeft === null ? '' : daysLeft <= 0 ? 'text-red-400' : daysLeft <= 30 ? 'text-amber-400' : 'text-emerald-400'
  const progressPct    = (() => {
    if (!client.membershipStartDate || !client.membershipExpiresAt) return 0
    const total = new Date(client.membershipExpiresAt).getTime() - new Date(client.membershipStartDate).getTime()
    const elapsed = Date.now() - new Date(client.membershipStartDate).getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })()
  const progressColor  = daysLeft === null ? 'bg-gray-400' : daysLeft <= 0 ? 'bg-red-500' : daysLeft <= 30 ? 'bg-amber-500' : 'bg-emerald-500'

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: 'pagos',      label: 'Pagos',      count: payments.length  },
    { value: 'asistencia', label: 'Asistencia', count: presentDays      },
    { value: 'turnos',     label: 'Turnos',     count: shiftStats.length },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4 md:space-y-5"
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate('/clients')}
        className="group flex items-center gap-2 text-sm text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>Clientes</span>
      </button>

      {/* ── HERO CARD ───────────────────────────────────────────────────────── */}
      <div className={`${glassCard} overflow-hidden`}>
        {/* Accent bar (status color) */}
        <div className={`h-1 w-full ${statusBarColor(client.status)}`} />

        <div className="p-5 md:p-7">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-start">
            {/* Avatar */}
            <div className={`h-16 w-16 md:h-20 md:w-20 rounded-2xl md:rounded-3xl flex items-center justify-center text-2xl md:text-3xl font-black shrink-0 ${avatarColors(client.status)}`}>
              {initials}
            </div>

            {/* Datos principales */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                    {client.name} {client.lastName}
                  </h1>
                  <p className="text-sm text-[#8A8A9A] mt-1">
                    Miembro desde {formatDate(client.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge status={client.status} />
                  {isAdmin && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/[0.09] transition-all"
                    >
                      <Edit2 size={12} />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {/* Contact chips */}
              <div className="flex flex-wrap gap-2 mt-4">
                {client.dni && (
                  <ContactChip icon={Hash} label={`DNI ${client.dni}`} />
                )}
                {client.email && (
                  <ContactChip icon={Mail} label={client.email} />
                )}
                {client.phone && (
                  <ContactChip
                    icon={Phone}
                    label={client.phone}
                    href={`https://wa.me/54${client.phone.replace(/\D/g, '')}`}
                  />
                )}
                {client.membershipExpiresAt && (
                  <ContactChip icon={CalendarDays} label={`Vence ${formatDate(client.membershipExpiresAt)}`} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon: TrendingUp,
            label: 'Total pagado',
            value: formatCurrency(totalPaid),
            iconColor: 'text-primary',
            iconBg: 'bg-primary/10',
          },
          {
            icon: Activity,
            label: 'Asistencias',
            value: String(presentDays),
            unit: 'veces',
            iconColor: 'text-emerald-500',
            iconBg: 'bg-emerald-500/10',
          },
          {
            icon: Clock,
            label: 'Última visita',
            value: lastVisit ? formatDate(lastVisit) : '—',
            iconColor: 'text-[#8A8A9A]',
            iconBg: 'bg-white/[0.06] dark:bg-white/[0.05]',
          },
        ].map(s => (
          <div
            key={s.label}
            className={`${glassCard} p-4 flex items-center gap-3`}
          >
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
              <s.icon size={18} className={s.iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-lg md:text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none truncate">
                {s.value}
              </p>
              <p className="text-xs text-[#8A8A9A] mt-0.5 truncate">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── GRID PRINCIPAL ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* ─ Plan / Membresía ─────────────────────────────────────────────── */}
        <div className={`${glassCard} p-5 h-fit space-y-5`}>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Tag size={15} className="text-primary" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">Plan activo</h3>
          </div>

          {client.planName ? (
            <>
              <div>
                <p className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                  {client.planName}
                </p>
                {client.planFrequency && (
                  <p className="text-sm text-[#8A8A9A] mt-1">
                    {client.planFrequency}× por semana
                  </p>
                )}
              </div>

              {client.planPrice != null && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-primary tabular-nums">
                    {formatCurrency(client.planPrice)}
                  </span>
                  <span className="text-xs text-[#8A8A9A] font-medium">/ mes</span>
                </div>
              )}

              <div className="space-y-2.5 text-sm border-t border-white/[0.06] pt-4">
                {client.membershipStartDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#8A8A9A]">Inicio</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatDate(client.membershipStartDate)}
                    </span>
                  </div>
                )}
                {client.membershipExpiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#8A8A9A]">Vencimiento</span>
                    <span className={`font-semibold ${expiryColor}`}>
                      {formatDate(client.membershipExpiresAt)}
                    </span>
                  </div>
                )}
                {daysLeft !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#8A8A9A]">Días restantes</span>
                    <span className={`font-bold ${expiryColor}`}>
                      {daysLeft > 0 ? daysLeft : 'Vencida'}
                    </span>
                  </div>
                )}
              </div>

              {client.membershipStartDate && client.membershipExpiresAt && (
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-[#8A8A9A] text-right">
                    {Math.round(progressPct)}% transcurrido
                  </p>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={Tag} message="Sin plan activo" />
          )}
        </div>

        {/* ─ Tabs ─────────────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">

          {/* Tab bar */}
          <div className="flex gap-1 p-1 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.07]">
            {TABS.map(t => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`flex items-center justify-center gap-2 flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  tab === t.value
                    ? 'bg-white dark:bg-white/[0.09] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-[#8A8A9A] hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <span>{t.label}</span>
                <span className={`min-w-[20px] text-center text-xs px-1.5 py-0.5 rounded-lg font-bold ${
                  tab === t.value
                    ? 'bg-primary/20 text-primary'
                    : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-[#8A8A9A]'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={`${glassCard} overflow-hidden min-h-[280px]`}>

            {/* ─── PAGOS ─────────────────────────────────────────────────── */}
            {tab === 'pagos' && (
              payments.length === 0
                ? <EmptyState icon={CreditCard} message="Sin pagos registrados" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.02]">
                        <tr>
                          {['Método', 'Monto', 'Fecha', 'Comprobante'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
                        {payments.map(p => {
                          const cfg = METHOD_CONFIG[p.method] ?? METHOD_CONFIG.cash
                          const MethodIcon = cfg.Icon
                          return (
                            <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-2.5">
                                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                    <MethodIcon size={14} className={cfg.color} />
                                  </div>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{cfg.label}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="text-base font-black text-gray-900 dark:text-white tabular-nums">
                                  {formatCurrency(p.amount)}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-[#8A8A9A] text-sm">
                                {formatDate(p.paidAt)}
                              </td>
                              <td className="px-5 py-3.5">
                                {p.invoiced
                                  ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg"><CheckCircle2 size={12} /> Sí</span>
                                  : <span className="inline-flex items-center gap-1 text-xs font-medium text-[#8A8A9A] bg-white/[0.05] px-2 py-1 rounded-lg"><XCircle size={12} /> No</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {/* ─── ASISTENCIA ────────────────────────────────────────────── */}
            {tab === 'asistencia' && (
              attendance.length === 0
                ? <EmptyState icon={Activity} message="Sin registros de asistencia" />
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b border-gray-200/60 dark:border-white/[0.06] bg-gray-50/40 dark:bg-white/[0.02]">
                        <tr>
                          {['Fecha', 'Turno', 'Estado'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#8A8A9A]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
                        {attendance.map(a => (
                          <tr key={a.id} className="hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                            <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300 text-sm">
                              {formatDate(a.date)}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <Dumbbell size={12} className="text-primary" />
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Turno #{a.shiftId}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              {a.present
                                ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg"><CheckCircle2 size={12} /> Presente</span>
                                : <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500 dark:text-red-400 bg-red-500/10 px-2 py-1 rounded-lg"><XCircle size={12} /> Ausente</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            )}

            {/* ─── TURNOS ────────────────────────────────────────────────── */}
            {tab === 'turnos' && (
              shiftStats.length === 0
                ? <EmptyState icon={Dumbbell} message="Sin turnos registrados" />
                : (
                  <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
                    {shiftStats.map(({ shiftId, present, total, lastDate }) => {
                      const pct = total > 0 ? Math.round((present / total) * 100) : 0
                      return (
                        <div key={String(shiftId)} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Dumbbell size={20} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              Turno #{shiftId}
                            </p>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-200/60 dark:bg-white/[0.08] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-[#8A8A9A] shrink-0">{pct}%</span>
                            </div>
                            <p className="text-xs text-[#8A8A9A]">
                              Último: {lastDate ? formatDate(lastDate) : '—'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums leading-none">
                              {present}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-[#8A8A9A] font-bold mt-0.5">
                              de {total}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL EDICIÓN ───────────────────────────────────────────────────── */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Editar cliente" size="md">
        <form onSubmit={handleSubmit(onEdit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre *"   error={errors.name?.message}     {...register('name')} />
            <Input label="Apellido *" error={errors.lastName?.message}  {...register('lastName')} />
          </div>
          <Input label="DNI *"   error={errors.dni?.message}   {...register('dni')} />
          <Input label="Email"   type="email" error={errors.email?.message}  {...register('email')} />
          <Input label="Teléfono" error={errors.phone?.message} {...register('phone')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button type="submit" isLoading={isSaving}>Guardar cambios</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
