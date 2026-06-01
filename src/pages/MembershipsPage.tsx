import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import {
  Plus, RefreshCw, Trash2, Edit2, X, Save,
  CheckCircle2, Layers, Pencil, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemberships } from '../hooks/useMemberships'
import { membershipsApi } from '../api/memberships.api'
import { tarifasApi } from '../api/tarifas.api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Skeleton from '../components/ui/Skeleton'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import type { Plan, Modalidad, TarifaVigente } from '../types/membership.types'
import { MODALIDAD_LABELS, MODALIDAD_DURACION, MODALIDADES } from '../types/membership.types'

// ── Esquemas de validación ────────────────────────────────────────────────────

const planSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  classesPerWeek: z
    .string()
    .min(1, 'Requerido')
    .refine((v) => Number(v) >= 1, 'Mínimo 1 clase'),
  description: z.string().optional(),
})
type PlanFormValues = z.infer<typeof planSchema>

const precioSchema = z.object({
  precio: z
    .string()
    .min(1, 'Requerido')
    .refine((v) => !isNaN(Number(v)) && Number(v) >= 0, 'Monto inválido'),
})
type PrecioFormValues = z.infer<typeof precioSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border-2 border-saas-border bg-white/60 dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all focus:border-primary focus:outline-none'
const labelCls =
  'mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'

// ── Componente editor de precio de una modalidad ──────────────────────────────

function PrecioRow({
  modalidad,
  tarifa,
  onSaved,
}: {
  modalidad: Modalidad
  tarifa?: TarifaVigente
  planId: string
  onSaved: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const addToast = useUiStore((s) => s.addToast)

  const { register, handleSubmit, formState: { errors }, reset } = useForm<PrecioFormValues>({
    resolver: zodResolver(precioSchema),
    defaultValues: { precio: tarifa ? String(tarifa.precio) : '' },
  })

  async function onSubmit(data: PrecioFormValues) {
    setIsSaving(true)
    try {
      const nuevoPrecio = Number(data.precio)
      if (tarifa) {
        await tarifasApi.updatePrecio(tarifa.id, nuevoPrecio)
      } else {
        // No debería ocurrir si el seed cargó bien, pero se cubre igual
        addToast('Error: la tarifa no existe. Corré el seed del backend.', 'error')
        return
      }
      addToast(`Precio de ${MODALIDAD_LABELS[modalidad]} actualizado`, 'success')
      setIsEditing(false)
      onSaved()
    } catch {
      addToast('Error al actualizar el precio', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  function handleCancel() {
    reset({ precio: tarifa ? String(tarifa.precio) : '' })
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/10 dark:border-white/[0.06] last:border-0">
      {/* Info modalidad */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
          {MODALIDAD_LABELS[modalidad]}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-[#8A8A9A]">
          {MODALIDAD_DURACION[modalidad]}
        </p>
      </div>

      {/* Precio o editor */}
      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-2"
          >
            <span className="text-base font-black tabular-nums text-gray-900 dark:text-white">
              {tarifa ? formatCurrency(tarifa.precio) : (
                <span className="text-sm font-medium text-gray-400 italic">Sin precio</span>
              )}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-primary transition-all"
              title="Editar precio"
            >
              <Pencil size={13} />
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="edit"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSubmit(onSubmit)}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                className="w-32 rounded-xl border-2 border-primary/50 bg-white dark:bg-white/10 pl-6 pr-2 py-1.5 text-sm font-bold text-gray-900 dark:text-white focus:border-primary focus:outline-none"
                autoFocus
                {...register('precio')}
              />
              {errors.precio && (
                <p className="absolute -bottom-4 left-0 text-[10px] text-red-500 whitespace-nowrap">
                  {errors.precio.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
              title="Guardar"
            >
              {isSaving
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600/30 border-t-emerald-600 block" />
                : <Save size={13} />
              }
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-all"
              title="Cancelar"
            >
              <X size={13} />
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Card de un plan ───────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onEdit,
  onDelete,
  onRefresh,
}: {
  plan: Plan
  onEdit: (plan: Plan) => void
  onDelete: (plan: Plan) => void
  onRefresh: () => void
}) {
  const [tarifasOpen, setTarifasOpen] = useState(true)

  const tarifaMap = Object.fromEntries(
    plan.tarifas.map((t) => [t.modalidad, t])
  ) as Record<Modalidad, TarifaVigente | undefined>

  return (
    <motion.div
      layout
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-300"
    >
      {/* ── Cabecera del plan ── */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner shrink-0">
              <Layers size={22} className="text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {plan.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-[#8A8A9A] mt-0.5">
                {plan.classesPerWeek === 5 ? '4 o 5' : plan.classesPerWeek} sesiones / semana
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {(plan.membresiaCount ?? 0) > 0 && (
              <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                {plan.membresiaCount} activas
              </span>
            )}
            <button
              onClick={() => onEdit(plan)}
              className="rounded-xl p-2 text-gray-400 hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition-all"
              title="Editar plan"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={() => onDelete(plan)}
              className="rounded-xl p-2 text-gray-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all"
              title="Eliminar plan"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {plan.description && (
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
            {plan.description}
          </p>
        )}
      </div>

      {/* ── Separador ── */}
      <div className="mx-6 border-t border-white/20 dark:border-white/[0.07]" />

      {/* ── Matriz de precios ── */}
      <div className="px-6 pb-6 pt-4">
        <button
          onClick={() => setTarifasOpen((v) => !v)}
          className="flex w-full items-center justify-between mb-3 group"
        >
          <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-[#8A8A9A] group-hover:text-primary transition-colors">
            Precios por modalidad
          </span>
          {tarifasOpen
            ? <ChevronUp size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-gray-400" />
          }
        </button>

        <AnimatePresence initial={false}>
          {tarifasOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div>
                {MODALIDADES.map((modalidad) => (
                  <PrecioRow
                    key={modalidad}
                    modalidad={modalidad}
                    tarifa={tarifaMap[modalidad]}
                    planId={plan.id}
                    onSaved={onRefresh}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function MembershipsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletePlanTarget, setDeletePlanTarget] = useState<Plan | null>(null)
  const [isDeletingPlan, setIsDeletingPlan] = useState(false)

  const { memberships, isLoading, error, refetch } = useMemberships()
  const addToast = useUiStore((s) => s.addToast)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: { classesPerWeek: '2' },
  })

  function openCreate() {
    reset({ classesPerWeek: '2' })
    setCreateOpen(true)
  }

  function openEdit(plan: Plan) {
    setEditingPlan(plan)
    setValue('name', plan.name)
    setValue('classesPerWeek', String(plan.classesPerWeek))
    setValue('description', plan.description ?? '')
  }

  function closeModal() {
    setCreateOpen(false)
    setEditingPlan(null)
    reset()
  }

  async function onSubmit(data: PlanFormValues) {
    setIsSubmitting(true)
    try {
      if (editingPlan) {
        await membershipsApi.update(editingPlan.id, {
          name: data.name,
          classesPerWeek: Number(data.classesPerWeek),
          description: data.description,
        })
        addToast('Plan actualizado', 'success')
      } else {
        await membershipsApi.create({
          name: data.name,
          classesPerWeek: Number(data.classesPerWeek),
          description: data.description,
        })
        addToast('Plan creado', 'success')
      }
      closeModal()
      refetch()
    } catch {
      addToast('Error al guardar el plan', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function deletePlan(plan: Plan) {
    if ((plan.membresiaCount ?? 0) > 0) {
      addToast(`No se puede eliminar: el plan tiene ${plan.membresiaCount} membresía(s) activa(s)`, 'error')
      return
    }
    setDeletePlanTarget(plan)
  }

  async function confirmDeletePlan() {
    if (!deletePlanTarget) return
    setIsDeletingPlan(true)
    try {
      await membershipsApi.remove(deletePlanTarget.id)
      addToast('Plan eliminado', 'success')
      refetch()
    } catch {
      addToast('Error al eliminar el plan', 'error')
    } finally {
      setIsDeletingPlan(false)
      setDeletePlanTarget(null)
    }
  }

  return (
    <motion.div {...pageVariants} className="space-y-8 pb-12 relative z-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
            Planes y Precios
          </h1>
          <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
            Configurá los planes y los precios por modalidad de pago
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-xl text-gray-600 dark:text-gray-300 transition-all hover:scale-105 hover:bg-white/50 dark:hover:bg-black/50 shadow-sm"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            Nuevo plan
          </button>
        </div>
      </div>

      {/* ── Info box ── */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <p><strong className="text-gray-900 dark:text-white">Para editar un precio:</strong> hacé clic en el ícono de lápiz junto al monto.</p>
          <p>El precio anterior queda guardado en el historial. Las membresías existentes mantienen su precio congelado.</p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={refetch} className="ml-auto text-xs text-red-400 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* ── Grid de planes ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-6"
            >
              <div className="flex items-center gap-3 mb-6">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </div>
              <div className="space-y-3 mt-4">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : memberships.length === 0 ? (
          <div className="col-span-full py-20 text-center">
            <Layers size={40} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-[#8A8A9A] font-medium">
              No hay planes registrados. Creá el primero.
            </p>
          </div>
        ) : (
          memberships.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={openEdit}
              onDelete={deletePlan}
              onRefresh={refetch}
            />
          ))
        )}
      </div>

      {/* ── Modal crear / editar plan ── */}
      <Modal
        isOpen={createOpen || editingPlan !== null}
        onClose={closeModal}
        title={editingPlan ? 'Editar plan' : 'Nuevo plan'}
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nombre del plan *"
            placeholder="Ej: 3 veces por semana"
            error={errors.name?.message}
            {...register('name')}
          />
          <div>
            <label className={labelCls}>Sesiones por semana *</label>
            <select
              className={inputCls}
              {...register('classesPerWeek')}
            >
              <option value="2">2 veces por semana</option>
              <option value="3">3 veces por semana</option>
              <option value="5">Full (4 o 5 veces por semana)</option>
            </select>
            {errors.classesPerWeek && (
              <p className="mt-1 text-xs text-red-500">{errors.classesPerWeek.message}</p>
            )}
          </div>
          <Input
            label="Descripción (opcional)"
            error={errors.description?.message}
            {...register('description')}
          />

          {!editingPlan && (
            <p className="text-xs text-gray-400 dark:text-[#8A8A9A] leading-relaxed">
              Una vez creado el plan, configurá los precios por modalidad directamente desde la card.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingPlan ? 'Guardar cambios' : 'Crear plan'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deletePlanTarget !== null}
        title={`Eliminar plan "${deletePlanTarget?.name ?? ''}"`}
        message="Los clientes con este plan asignado quedarán sin plan. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        isLoading={isDeletingPlan}
        onConfirm={confirmDeletePlan}
        onClose={() => setDeletePlanTarget(null)}
      />
    </motion.div>
  )
}
