import { useState, useEffect } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Check, Dumbbell } from 'lucide-react'
import { ejerciciosApi } from '../api/ejercicios.api'
import { patronesApi, type PatronMovimientoConfig } from '../api/patrones.api'
import { categoriasEjercicioApi, type CategoriaEjercicio } from '../api/categorias-ejercicio.api'
import { useUiStore } from '../store/uiStore'
import { usePermissions } from '../hooks/usePermissions'
import { ROUTES } from '../constants/routes'
import DotsLoader from '../components/ui/DotsLoader'

const glass    = 'rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
const inputCls = 'w-full rounded-xl border border-gray-200 dark:border-white/[0.1] bg-gray-50 dark:bg-white/[0.05] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 transition-colors'
const labelCls = 'block text-[10px] font-bold text-gray-500 dark:text-[#8A8A9A] mb-1 uppercase tracking-wider'

const schema = z.object({
  nombre:           z.string().min(1, 'Requerido'),
  descripcion:      z.string().optional(),
  videoUrl:         z.string().optional(),
  patronMovimiento: z.string().optional(),
  categoriaId:      z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function EjercicioDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const addToast  = useUiStore(s => s.addToast)
  const { can }   = usePermissions()
  const isNew     = id === 'new'

  const [loadingData, setLoadingData] = useState(!isNew)
  const [saving, setSaving]           = useState(false)
  const [patrones, setPatrones]       = useState<PatronMovimientoConfig[]>([])
  const [categorias, setCategorias]   = useState<CategoriaEjercicio[]>([])

  useEffect(() => {
    patronesApi.getAll(true).then(setPatrones).catch(() => {})
    categoriasEjercicioApi.getAll(true).then(setCategorias).catch(() => {})
  }, [])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { categoriaId: '' },
  })

  useEffect(() => {
    if (!isNew && id) {
      setLoadingData(true)
      ejerciciosApi.getById(id)
        .then(ej => reset({
          nombre:           ej.nombre,
          descripcion:      ej.descripcion      ?? '',
          videoUrl:         ej.videoUrl         ?? '',
          patronMovimiento: ej.patronMovimiento  ?? '',
          categoriaId:      ej.categoriaId       ?? '',
        }))
        .catch(() => { addToast('Error al cargar el ejercicio', 'error'); navigate(ROUTES.EXERCISES) })
        .finally(() => setLoadingData(false))
    }
  }, [id, isNew, reset, addToast, navigate])

  const readOnly = !can('exercises', 'create')

  if (isNew && readOnly) return <Navigate to={ROUTES.EXERCISES} replace />

  async function onSubmit(data: FormValues) {
    setSaving(true)
    try {
      const payload = {
        ...data,
        descripcion:      data.descripcion      || undefined,
        videoUrl:         data.videoUrl         || undefined,
        patronMovimiento: data.patronMovimiento  || undefined,
        categoriaId:      data.categoriaId       || undefined,
      }
      if (isNew) {
        await ejerciciosApi.create(payload)
        addToast('Ejercicio creado', 'success')
      } else {
        await ejerciciosApi.update(id!, payload)
        addToast('Ejercicio actualizado', 'success')
      }
      navigate(ROUTES.EXERCISES)
    } catch {
      addToast('Error al guardar el ejercicio', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={() => navigate(ROUTES.EXERCISES)}
          className="group flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/40 hover:text-gray-900 dark:hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a ejercicios
        </button>
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
          {isNew ? 'Nuevo ejercicio' : readOnly ? 'Ver ejercicio' : 'Editar ejercicio'}
        </h1>
      </div>

      {/* Formulario */}
      <AnimatePresence mode="wait">
        {loadingData ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`${glass} p-6 space-y-3`}>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
            ))}
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`${glass} p-6`}>
            <form onSubmit={readOnly ? undefined : handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Nombre *</label>
                  <input {...register('nombre')} placeholder="ej. Press de banca" className={inputCls} disabled={readOnly} />
                  {errors.nombre && <p className="mt-0.5 text-[11px] text-red-400">{errors.nombre.message}</p>}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={labelCls}>Categoría</label>
                  <select {...register('categoriaId')} className={inputCls + ' cursor-pointer'} disabled={readOnly}>
                    <option value="">— Sin categoría —</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Descripción</label>
                <input {...register('descripcion')} placeholder="ej. Ejercicio compuesto para pecho, hombros y tríceps" className={inputCls} disabled={readOnly} />
              </div>
              <div>
                <label className={labelCls}>URL del video (YouTube, etc.)</label>
                <input {...register('videoUrl')} placeholder="https://youtube.com/watch?v=..." className={inputCls} disabled={readOnly} />
              </div>
              <div>
                <label className={labelCls}>Patrón de movimiento</label>
                <select {...register('patronMovimiento')} className={inputCls + ' cursor-pointer'} disabled={readOnly}>
                  <option value="">— Sin especificar —</option>
                  {patrones.map(p => (
                    <option key={p.clave} value={p.clave}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                {!readOnly && (
                  <motion.button
                    type="submit"
                    disabled={saving}
                    whileTap={!saving ? { scale: 0.96 } : {}}
                    className="flex items-center gap-2 rounded-xl btn-action px-4 py-2.5 text-sm disabled:opacity-50"
                  >
                    {saving
                      ? <DotsLoader size="sm" className="flex items-center" />
                      : <Check size={14} />}
                    {isNew ? 'Crear ejercicio' : 'Guardar cambios'}
                  </motion.button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.EXERCISES)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm text-gray-500 dark:text-[#8A8A9A] hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {readOnly ? 'Volver' : 'Cancelar'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
