import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { pageVariants } from '../lib/motion'
import { Plus, Tag, RefreshCw, Trash2, Edit2, CheckCircle2, X, Save } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMemberships } from '../hooks/useMemberships'
import { membershipsApi } from '../api/memberships.api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import Skeleton from '../components/ui/Skeleton'
import { formatCurrency } from '../utils/formatCurrency'
import type { Membership } from '../types/membership.types'

const schema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  price: z.string().min(1, 'El precio es requerido').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Precio inválido'),
  classesPerWeek: z.string().min(1, 'Cantidad es requerida').refine(v => !isNaN(Number(v)) && Number(v) > 0, 'Cantidad inválida'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const inputCls = 'w-full rounded-xl border-2 border-saas-border bg-white/60 dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 transition-all focus:border-[#FBC608] focus:outline-none focus:shadow-[0_0_0_3px_rgba(251,198,8,0.12)]'
const labelCls = 'mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500'

export default function MembershipsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { memberships, isLoading, error, refetch } = useMemberships()
  const addToast = useUiStore(s => s.addToast)

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { classesPerWeek: '2' },
  })

  function startEdit(m: Membership) {
    setEditingId(m.id)
    setValue('name', m.name)
    setValue('price', String(m.price))
    setValue('classesPerWeek', String(m.classesPerWeek))
    setValue('description', m.description || '')
  }

  function discardEdit() {
    setEditingId(null)
    reset()
  }

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true)
    try {
      if (editingId !== null) {
        await membershipsApi.update(editingId, {
          name: data.name,
          price: Number(data.price),
          classesPerWeek: Number(data.classesPerWeek),
          description: data.description,
        })
        addToast('Membresía actualizada', 'success')
        setEditingId(null)
      } else {
        await membershipsApi.create({
          name: data.name,
          price: Number(data.price),
          classesPerWeek: Number(data.classesPerWeek),
          description: data.description,
        })
        addToast('Membresía creada', 'success')
        setCreateOpen(false)
      }
      reset()
      refetch()
    } catch {
      addToast('Error al guardar la membresía', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function deleteMembership(id: number) {
    if (!confirm('¿Eliminar esta membresía?')) return
    try {
      await membershipsApi.remove(id)
      addToast('Membresía eliminada', 'success')
      refetch()
    } catch {
      addToast('Error al eliminar', 'error')
    }
  }

  return (
    <motion.div {...pageVariants} className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          Membresías
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-saas-border bg-white text-gray-400 transition-all hover:bg-saas-bg hover:text-gray-900 active:scale-[0.98]"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => { reset(); setCreateOpen(true) }}
            className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gray-900/10">
              <Plus size={13} strokeWidth={2.5} />
            </span>
            Nueva membresía
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={refetch} className="ml-auto text-xs text-red-400 underline">Reintentar</button>
        </div>
      )}

      {/* Grid de planes */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[320px] rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-8"
            >
              <div className="flex items-center gap-3 mb-8">
                <Skeleton className="h-12 w-12 rounded-2xl" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-12 w-40 mb-2" />
              <Skeleton className="h-4 w-20 mb-8" />
              <div className="space-y-3">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            </div>
          ))
        ) : memberships.length === 0 ? (
          <div className="col-span-full py-16 text-center text-saas-muted">
            No hay membresías registradas
          </div>
        ) : (
          memberships.map(m => {
            const isEditing = editingId === m.id

            return (
              <motion.div
                key={m.id}
                layout
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className={`relative overflow-hidden rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-shadow duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] flex flex-col ${
                  isEditing ? 'min-h-[420px] ring-2 ring-[#FBC608]/30' : 'min-h-[320px] hover:-translate-y-1 transition-all'
                }`}
              >
                <div className="relative z-10 flex flex-1 flex-col">

                  {/* Cabecera siempre visible */}
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-colors duration-300 ${isEditing ? 'bg-[#FBC608]/15' : 'bg-primary/10'}`}>
                        <Tag size={22} className={isEditing ? 'text-[#D4A800]' : 'text-primary'} />
                      </div>
                      {!isEditing && (
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{m.name}</h3>
                      )}
                      {isEditing && (
                        <span className="text-xs font-bold uppercase tracking-widest text-[#D4A800]">
                          Editando
                        </span>
                      )}
                    </div>

                    <div className="flex gap-1">
                      {!isEditing ? (
                        <>
                          <button
                            onClick={() => startEdit(m)}
                            className="rounded-xl p-2 text-gray-400 transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => deleteMembership(m.id)}
                            className="rounded-xl p-2 text-gray-400 transition-all hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={discardEdit}
                          className="rounded-xl p-2 text-gray-400 transition-all hover:bg-white/60 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white"
                          title="Descartar cambios"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vista normal */}
                  <AnimatePresence mode="wait">
                    {!isEditing ? (
                      <motion.div
                        key="display"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex flex-1 flex-col"
                      >
                        <div className="mb-8">
                          <div className="flex items-end gap-1.5">
                            <span className="text-4xl font-black tabular-nums tracking-tighter text-gray-900 dark:text-white">
                              {formatCurrency(m.price)}
                            </span>
                            <span className="mb-1 text-sm font-medium text-gray-400 dark:text-gray-500">/ mes</span>
                          </div>
                        </div>
                        <div className="mt-auto space-y-3">
                          <div className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                            <CheckCircle2 size={16} className="shrink-0 text-primary" />
                            <span>{m.classesPerWeek} clases por semana</span>
                          </div>
                          {m.description && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-3 pl-0.5">
                              {m.description}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ) : (

                      /* Formulario inline */
                      <motion.form
                        key="edit"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onSubmit={handleSubmit(onSubmit)}
                        className="flex flex-1 flex-col gap-4"
                      >
                        <div>
                          <label className={labelCls}>Nombre</label>
                          <input className={inputCls} placeholder="Nombre del plan" {...register('name')} />
                          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Precio / mes</label>
                            <input type="number" className={inputCls} placeholder="0" {...register('price')} />
                            {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price.message}</p>}
                          </div>
                          <div>
                            <label className={labelCls}>Clases / semana</label>
                            <input type="number" className={inputCls} placeholder="0" {...register('classesPerWeek')} />
                            {errors.classesPerWeek && <p className="mt-1 text-xs text-red-500">{errors.classesPerWeek.message}</p>}
                          </div>
                        </div>

                        <div>
                          <label className={labelCls}>Descripción</label>
                          <textarea
                            rows={2}
                            className={`${inputCls} resize-none`}
                            placeholder="Descripción opcional..."
                            {...register('description')}
                          />
                        </div>

                        {/* Acciones */}
                        <div className="mt-auto flex gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={discardEdit}
                            className="flex-1 rounded-xl border border-saas-border bg-white/50 dark:bg-white/5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-all hover:bg-white dark:hover:bg-white/10 active:scale-[0.97]"
                          >
                            Descartar
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl btn-action py-2.5 text-sm"
                          >
                            {isSubmitting
                              ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900/30 border-t-gray-900" />
                              : <Save size={14} />
                            }
                            Guardar
                          </button>
                        </div>
                      </motion.form>
                    )}
                  </AnimatePresence>

                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* Modal solo para crear */}
      <Modal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); reset() }}
        title="Nueva membresía"
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Nombre del plan *" error={errors.name?.message} {...register('name')} />
          <Input label="Precio mensual *" type="number" error={errors.price?.message} {...register('price')} />
          <Input label="Clases por semana *" type="number" error={errors.classesPerWeek?.message} {...register('classesPerWeek')} />
          <Input label="Descripción (Opcional)" error={errors.description?.message} {...register('description')} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => { setCreateOpen(false); reset() }}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>Crear</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  )
}
