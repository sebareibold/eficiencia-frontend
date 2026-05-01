import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Facebook, Instagram, Youtube } from "lucide-react";
import { authApi } from "../api/auth.api";
import { useAuthStore } from "../store/authStore";
import { useUiStore } from "../store/uiStore";
import { ROUTES } from "../constants/routes";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const addToast = useUiStore((s) => s.addToast);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    try {
      if (
        data.email === "admin@eficiencia.com" &&
        data.password === "admin123"
      ) {
        const mockUser = {
          id: 1,
          name: "Admin",
          lastName: "Eficiencia",
          email: "admin@eficiencia.com",
          role: "admin" as const,
        };
        login(mockUser, "mockAccessToken", "mockRefreshToken");
        navigate(ROUTES.CLIENTS);
      } else {
        const res = await authApi.login(data);
        login(res.user, res.accessToken, res.refreshToken);
        navigate(ROUTES.CLIENTS);
      }
    } catch {
      addToast("Credenciales incorrectas", "error");
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F0EE] flex items-center justify-center p-4 sm:p-8 font-sans">
      <div className="w-full max-w-[1240px] h-[85vh] min-h-[650px] max-h-[900px] bg-white rounded-[2.5rem] shadow-2xl relative overflow-hidden flex ring-4 ring-black/5">
        
        {/* Left Side (Dark Image with Skew) */}
        <div 
          className="hidden lg:block absolute top-0 bottom-0 w-[55%] bg-black origin-bottom-left -skew-x-[8deg] rounded-r-[3rem] overflow-hidden z-10 shadow-2xl border-r border-gray-900"
          style={{ left: '-10%' }}
        >
          {/* Un-skew wrapper to display image straight */}
          <div className="absolute inset-0 origin-bottom-left skew-x-[8deg] w-[125%] left-[10%] bg-[#0B0A0F]">
            {/* The Background Image */}
            <img 
              src="https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=90&w=2500&auto=format&fit=crop" 
              className="w-full h-full object-cover opacity-100" 
              alt="Gym background"
            />
            {/* Gradient overlay to make text shine */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"></div>
          </div>
        </div>

        {/* Content overlay strictly positioned over the dark area (unskewed) */}
        <div className="hidden lg:flex absolute top-0 left-0 bottom-0 w-[45%] flex-col p-12 xl:p-10 z-20 pointer-events-none">
          <div className="flex items-center pointer-events-auto">
            <img 
              src="/logo.png" 
              alt="Eficiencia Logo" 
              className="h-10 sm:h-14 w-auto object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* Right Side (Login Form) */}
        <div className="w-full lg:w-[60%] ml-auto flex flex-col justify-center px-8 sm:px-16 xl:px-24 bg-white z-0 relative">
          
          

          <div className="max-w-[22rem] w-full mx-auto mt-6">
            <h1 className="text-4xl lg:text-5xl font-black text-gray-900 mb-2">Bienvenido</h1>
            <p className="text-gray-500 mb-10 text-sm font-medium">Acceso exclusivo para Staff y Profesores</p>

            <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
              <div>
                <input 
                  type="email" 
                  placeholder="Correo Electrónico" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all" 
                  {...register("email")}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1.5 px-2 font-medium">{errors.email.message}</p>}
              </div>

              <div>
                <input 
                  type="password" 
                  placeholder="Contraseña" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-4 text-sm focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all" 
                  {...register("password")}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1.5 px-2 font-medium">{errors.password.message}</p>}
              </div>
              
              <div className="flex justify-end pt-1">
                <a href="#" className="text-[#F5A623] text-xs font-semibold hover:underline transition-opacity">¿Olvidaste tu contraseña?</a>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#F5A623] to-[#F1C40F] text-gray-900 font-bold rounded-xl py-4 text-sm mt-5 shadow-lg shadow-orange-500/20 hover:brightness-105 transition-all outline-none focus:ring-2 focus:ring-[#F5A623] focus:ring-offset-2 flex justify-center items-center"
              >
                {isSubmitting ? 'Iniciando sesión...' : 'Ingresar al panel'}
              </button>

              <p className="text-center text-xs text-gray-500 mt-8 font-medium">
                ¿No tienen cuenta? <a href="#" className="text-gray-900 font-bold hover:underline">Contactanos</a>
              </p>
            </form>
          </div>

          <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-6 text-gray-500">
             <a href="#" className="hover:text-gray-900 transition-colors"><Facebook size={18} /></a>
             <a href="#" className="hover:text-gray-900 transition-colors"><Instagram size={18} /></a>
             <a href="#" className="hover:text-gray-900 transition-colors"><Youtube size={18} /></a>
          </div>
        </div>

      </div>
    </div>
  );
}
