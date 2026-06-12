import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, LogIn, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { authApi } from "../api/auth.api";
import { solicitudesApi } from "../api/solicitudes.api";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { useUiStore } from "../store/uiStore";
import { ROUTES } from "../constants/routes";
import { duration, ease } from "../lib/motion";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const requestSchema = z.object({
  name: z.string().min(2, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  role: z.enum(["STAFF", "PROFESOR", "CLIENTE_COMUN"], { required_error: "Seleccioná un rol" }),
});

type FormValues = z.infer<typeof schema>;
type RequestFormValues = z.infer<typeof requestSchema>;

const gymImages = ["/img-gym-1.png", "/img-gym-2.png", "/img-gym-3.png"];

/* ── Animation Variants ─────────────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: duration.slow, ease: ease.spring },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.crawl, ease: ease.spring },
  },
};

const logoVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: duration.crawl, ease: ease.overshoot },
  },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const applyFromServer = useSettingsStore((s) => s.applyFromServer);
  const addToast = useUiStore((s) => s.addToast);
  const [showPassword, setShowPassword] = useState(false);
  const [showReqPassword, setShowReqPassword] = useState(false);
  const [isFocused, setIsFocused] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [view, setView] = useState<'login' | 'request'>('login');
  const [requestSent, setRequestSent] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % gymImages.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset: resetLogin
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const {
    register: registerRequest,
    handleSubmit: handleSubmitRequest,
    formState: { errors: errorsRequest, isSubmitting: isSubmittingRequest },
    reset: resetRequest
  } = useForm<RequestFormValues>({ resolver: zodResolver(requestSchema) });

  async function onSubmit(data: FormValues) {
    setLoginError(null)
    try {
      const res = await authApi.login(data);
      login(res.user, res.accessToken, res.permissions);
      applyFromServer(res.serverConfig);
      const role = res.user.role
      const dest = role === 'admin' ? ROUTES.DASHBOARD
        : role === 'profesor' ? ROUTES.SHIFTS
          : role === 'cliente_comun' ? ROUTES.EJECUCION
            : ROUTES.CLIENTS
      navigate(dest);
    } catch (err: unknown) {
      const status = (err as any)?.response?.status
      if (status === 429) {
        setLoginError('Demasiados intentos fallidos. Esperá un minuto e intentá de nuevo.')
      } else if (status === 401) {
        setLoginError('Email o contraseña incorrectos. Revisá tus datos e intentá de nuevo.')
      } else {
        setLoginError('No se pudo conectar al servidor. Verificá tu conexión.')
      }
    }
  }

  async function onRequestSubmit(data: RequestFormValues) {
    try {
      await solicitudesApi.create({
        nombre: data.name,
        email: data.email,
        password: data.password,
        rolSolicitado: data.role,
      })
      setRequestSent(true);
    } catch {
      addToast("Error al enviar la solicitud. Intentá de nuevo.", "error");
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#fafafa] dark:bg-[#050505] transition-colors duration-300 px-4 md:px-6 lg:px-10 py-[clamp(0.5rem,2.5vh,2.5rem)]">

      {/* ── Background Layer 1: Subtle Grid ──────────────────────────── */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]" />

      {/* ── Background Layer 2: Glowing Orbs ─────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-[#FCE38A]/55 to-[#FBC608]/35 dark:from-[#FBC608]/22 dark:to-[#FCE38A]/8 blur-[140px] mix-blend-multiply dark:mix-blend-screen animate-pulse"
          style={{ animationDuration: "10s" }}
        />
        <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-[#F59E0B]/35 to-[#FBC608]/18 dark:from-[#F59E0B]/14 dark:to-transparent blur-[160px] mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-gradient-to-t from-white/60 to-transparent dark:from-[#FBC608]/6 dark:to-transparent blur-[100px]" />
      </div>

      {/* ── Background Layer 3: Vignette ─────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.07) 100%)" }}
      />

      {/* ── Background Layer 4: Noise Texture ────────────────────────── */}
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.4] dark:opacity-[0.25] mix-blend-overlay">
        <filter id="loginNoiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#loginNoiseFilter)" />
      </svg>

      {/* ── Layout Container: Single Outer Card ─────────────────────── */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[980px] 2xl:max-w-[1240px] h-[min(84vh,780px)] rounded-[2.5rem] border border-white/50 dark:border-white/10 bg-white/20 dark:bg-white/[0.03] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] p-4 overflow-hidden"
      >
        {/* Outer card glow effects */}
        <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-[#FBC608]/8 dark:bg-[#FBC608]/4 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-56 h-56 rounded-full bg-[#FBC608]/6 dark:bg-[#FBC608]/3 blur-[100px] pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">

          {/* ── Left Column (2 Visual Cards) ────────────────────────────── */}
          <div className="hidden lg:flex lg:col-span-5 flex-col gap-4">
            {/* Card 1: Main Display (Carousel) */}
            <div className="flex-[4] relative overflow-hidden rounded-[2rem] bg-black">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImage}
                  src={gymImages[currentImage]}
                  alt={`Gym Interior ${currentImage + 1}`}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-cover contrast-[1.02] brightness-[0.95]"
                />
              </AnimatePresence>

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

              <div className="absolute bottom-14 left-8 right-8 z-10">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                >
                  <h2 className="text-xl xl:text-2xl font-black text-white tracking-tighter mb-2 leading-tight">
                    Transformando <br />
                    <span className="text-[#FBC608]">la gestión deportiva</span>
                  </h2>
                  <p className="text-sm text-white/70 font-medium max-w-md">
                    Control total y eficiencia absoluta en cada proceso. Tecnología diseñada para elevar los estándares de tu gestión deportiva.
                  </p>
                </motion.div>
              </div>

              {/* Pagination Dots */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {gymImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImage(i)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${i === currentImage ? "w-8 bg-[#FBC608]" : "w-2 bg-white/30 hover:bg-white/50"
                      }`}
                  />
                ))}
              </div>
            </div>

          </div>

          {/* ── Right Column (Login Form) ──────────────────────────────── */}
          <div className="lg:col-span-7 flex items-center justify-center p-2 sm:p-4 lg:p-0">
            <div className={`w-full h-full relative overflow-hidden rounded-[2rem] bg-white/40 dark:bg-black/30 backdrop-blur-xl border border-white/30 dark:border-white/[0.06] px-6 sm:px-10 py-[clamp(1rem,3vh,2.5rem)] flex flex-col justify-center`}>

              {/* Card inner glow effect */}
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#FBC608]/10 dark:bg-[#FBC608]/5 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-[#FBC608]/8 dark:bg-[#FBC608]/3 blur-3xl pointer-events-none" />

              {/* Animated Form Container */}
              <div className="relative z-10 max-w-xl mx-auto w-full">
                <AnimatePresence mode="wait">
                  {view === 'login' ? (
                    <motion.div
                      key="login-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="w-full flex flex-col"
                    >
                      {/* Logo & Header */}
                      <div className="text-center mb-[clamp(1rem,3vh,2.5rem)]">
                        <div className="flex justify-center mb-[clamp(0.75rem,2.5vh,2rem)]">
                          <img src="/logo.png" alt="Logo" className="h-[clamp(4rem,9vh,6.5rem)] w-auto object-contain drop-shadow-md" />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 dark:text-white drop-shadow-sm">
                          Panel de Acceso
                        </h1>
                        <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                          Ingresá tus credenciales de administrador para gestionar tu plataforma.
                        </p>
                      </div>

                      {/* Form */}
                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1">
                        <div className="flex flex-col gap-2">
                          <label className="text-sm font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Email</label>
                          <input
                            type="email"
                            {...register("email", { onChange: () => setLoginError(null) })}
                            className={`w-full rounded-xl border ${errors.email ? "border-red-400" : "border-gray-200 dark:border-white/10"} bg-white/50 dark:bg-black/40 px-5 py-3 text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-[#FBC608]/10 shadow-sm`}
                          />
                          {errors.email && <span className="text-xs font-bold text-red-500 ml-1">{errors.email.message}</span>}
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Contraseña</label>
                            <a href="#" className="text-xs font-bold text-[#FBC608] hover:text-[#D4A800]">¿Olvidaste tu contraseña?</a>
                          </div>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              {...register("password", { onChange: () => setLoginError(null) })}
                              className={`w-full rounded-xl border ${errors.password ? "border-red-400" : "border-gray-200 dark:border-white/10"} bg-white/50 dark:bg-black/40 px-5 py-3 pr-12 text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-[#FBC608]/10 shadow-sm`}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                          {errors.password && <span className="text-xs font-bold text-red-500 ml-1">{errors.password.message}</span>}
                        </div>

                        {loginError && (
                          <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3"
                          >
                            <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{loginError}</p>
                          </motion.div>
                        )}

                        <div className="pt-[clamp(0.5rem,1.5vh,1rem)]">
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="group relative w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#FBC608] text-[#111827] font-bold py-3.5 text-sm shadow-md hover:bg-[#F5A623] active:bg-[#D4A800] transition-colors duration-200 cursor-pointer"
                          >
                            {isSubmitting ? "Iniciando sesión..." : <><LogIn size={20} /> Ingresar al Sistema</>}
                          </button>
                          <p className="mt-[clamp(0.75rem,2vh,1.5rem)] text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                            ¿No tenés acceso?{" "}
                            <button type="button" onClick={() => setView('request')} className="text-[#FBC608] hover:underline font-bold">Solicitá una cuenta</button>
                          </p>
                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="request-form"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="w-full flex flex-col"
                    >
                      {requestSent ? (
                        <div className="flex flex-col items-center justify-center text-center gap-5 py-8">
                          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/15">
                            <CheckCircle2 size={32} className="text-emerald-500" />
                          </div>
                          <div>
                            <h2 className="text-xl font-black tracking-tighter text-gray-900 dark:text-white">
                              ¡Solicitud enviada!
                            </h2>
                            <p className="mt-2 text-sm font-semibold text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
                              Revisá tu email — un administrador aprobará tu cuenta a la brevedad.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setView('login'); setRequestSent(false); resetRequest(); }}
                            className="w-full rounded-xl bg-[#FBC608] text-[#111827] font-bold py-3 text-sm shadow-md hover:bg-[#F5A623] active:bg-[#D4A800] transition-colors duration-200 cursor-pointer"
                          >
                            Volver al inicio de sesión
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Header */}
                          <div className="text-center mb-3">
                            <div className="flex justify-center mb-3">
                              <img src="/logo.png" alt="Logo" className="h-[clamp(3.5rem,7.5vh,5.5rem)] w-auto object-contain drop-shadow-md" />
                            </div>
                            <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-gray-900 dark:text-white">
                              Solicitar Acceso
                            </h1>
                            <p className="mt-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                              Completá tus datos para solicitar acceso a la plataforma.
                            </p>
                          </div>

                          <form onSubmit={handleSubmitRequest(onRequestSubmit)} className="space-y-3 flex-1">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Nombre Completo</label>
                              <input {...registerRequest("name")} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/40 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-[#FBC608]/10" />
                              {errorsRequest.name && <span className="text-xs font-bold text-red-500 ml-1">{errorsRequest.name.message}</span>}
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Email</label>
                              <input type="email" {...registerRequest("email")} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/40 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-[#FBC608]/10" />
                              {errorsRequest.email && <span className="text-xs font-bold text-red-500 ml-1">{errorsRequest.email.message}</span>}
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Contraseña deseada</label>
                              <div className="relative">
                                <input
                                  type={showReqPassword ? "text" : "password"}
                                  {...registerRequest("password")}
                                  className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/40 px-4 py-2.5 pr-11 text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-[#FBC608]/10"
                                />
                                <button type="button" onClick={() => setShowReqPassword(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                  {showReqPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              </div>
                              {errorsRequest.password && <span className="text-xs font-bold text-red-500 ml-1">{errorsRequest.password.message}</span>}
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold tracking-tight text-gray-700 dark:text-gray-300 ml-1">Rol solicitado</label>
                              <select
                                {...registerRequest("role")}
                                className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-black/40 px-4 py-2.5 text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-black/80 focus:outline-none focus:ring-4 focus:ring-[#FBC608]/10 cursor-pointer"
                              >
                                <option value="">Seleccioná un rol…</option>
                                <option value="CLIENTE_COMUN">Cliente del gimnasio</option>
                                <option value="STAFF">Staff</option>
                                <option value="PROFESOR">Profesor</option>
                              </select>
                              {errorsRequest.role && <span className="text-xs font-bold text-red-500 ml-1">{errorsRequest.role.message}</span>}
                            </div>

                            <div className="pt-1 space-y-3">
                              <button
                                type="submit"
                                disabled={isSubmittingRequest}
                                className="w-full rounded-xl bg-[#FBC608] text-[#111827] font-bold py-3 text-sm shadow-md hover:bg-[#F5A623] active:bg-[#D4A800] transition-colors duration-200 cursor-pointer"
                              >
                                {isSubmittingRequest ? "Enviando..." : "Enviar Solicitud"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setView('login')}
                                className="w-full text-center text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-[#FBC608] transition-colors py-1.5"
                              >
                                Volver al inicio de sesión
                              </button>
                            </div>
                          </form>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
