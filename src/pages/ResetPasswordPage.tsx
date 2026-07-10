import { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, CheckCircle2, XCircle, Lock } from 'lucide-react'
import { authApi } from '../api/auth.api'
import { ROUTES } from '../constants/routes'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const inputClass = "w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/40 px-5 py-3 pr-12 text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-[#FBC608]/10 shadow-sm"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('El link de recuperación es inválido. Solicitá uno nuevo.')
      return
    }
    if (password.length < 10) {
      setError('La contraseña debe tener al menos 10 caracteres.')
      return
    }
    if (!/[A-Z]/.test(password)) {
      setError('La contraseña debe tener al menos una mayúscula.')
      return
    }
    if (!/[a-z]/.test(password)) {
      setError('La contraseña debe tener al menos una minúscula.')
      return
    }
    if (!/[0-9]/.test(password)) {
      setError('La contraseña debe tener al menos un número.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setSuccess(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg || 'No se pudo restablecer la contraseña. El link puede haber expirado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#fafafa] dark:bg-[#050505] transition-colors duration-300 px-4 py-10">
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-[#FCE38A]/55 to-[#FBC608]/35 dark:from-[#FBC608]/22 dark:to-[#FCE38A]/8 blur-[140px] mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-[#F59E0B]/35 to-[#FBC608]/18 dark:from-[#F59E0B]/14 dark:to-transparent blur-[160px] mix-blend-multiply dark:mix-blend-screen" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/40 dark:bg-black/30 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-8"
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center gap-5 py-4"
            >
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/15">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tighter text-gray-900 dark:text-white">
                  ¡Contraseña actualizada!
                </h2>
                <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Ya podés ingresar con tu nueva contraseña.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.LOGIN)}
                className="w-full rounded-xl bg-[#FBC608] text-[#111827] font-bold py-3 text-sm shadow-md hover:bg-[#F5A623] active:bg-[#D4A800] transition-colors"
              >
                Ir al inicio de sesión
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Header */}
              <div className="text-center mb-8">
                <div className="flex justify-center mb-5">
                  <img src="/logo.png" alt="Logo" className="h-20 w-auto object-contain drop-shadow-md" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Lock size={18} className="text-[#FBC608]" />
                  <h1 className="text-xl font-black tracking-tighter text-gray-900 dark:text-white">
                    Nueva contraseña
                  </h1>
                </div>
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Elegí una contraseña segura para tu cuenta.
                </p>
              </div>

              {!token && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3">
                  <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                    Link inválido. Solicitá un nuevo email de recuperación.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Nueva contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null) }}
                      autoComplete="new-password"
                      className={inputClass}
                      disabled={!token}
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">Mínimo 10 caracteres, una mayúscula, una minúscula y un número.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Confirmar contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setError(null) }}
                      autoComplete="new-password"
                      className={inputClass}
                      disabled={!token}
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3"
                    >
                      <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="pt-2 space-y-3">
                  <button
                    type="submit"
                    disabled={loading || !token}
                    className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#FBC608] text-[#111827] font-bold py-3.5 text-sm shadow-md hover:bg-[#F5A623] active:bg-[#D4A800] transition-colors disabled:opacity-60"
                  >
                    {loading
                      ? <><span className="h-4 w-4 rounded-full border-2 border-[#111]/20 border-t-[#111] animate-spin" /> Guardando...</>
                      : 'Guardar nueva contraseña'
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(ROUTES.LOGIN)}
                    className="w-full text-center text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-[#FBC608] transition-colors py-1.5"
                  >
                    Volver al inicio de sesión
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
