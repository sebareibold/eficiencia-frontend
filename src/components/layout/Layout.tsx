import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import ToastContainer from '../ui/Toast'

export default function Layout() {
  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-[#fafafa] dark:bg-[#050505] transition-colors duration-300">
      
      {/* 1. Subtle Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]"></div>

      {/* 2. Glassmorphic Glowing Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top Left — primary accent glow */}
        <div
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[140px] mix-blend-multiply dark:mix-blend-screen animate-pulse"
          style={{
            animationDuration: '10s',
            background: 'radial-gradient(ellipse at center, rgb(var(--color-primary) / 0.45) 0%, transparent 70%)',
          }}
        />
        {/* Bottom Right — secondary accent glow */}
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[160px] mix-blend-multiply dark:mix-blend-screen"
          style={{
            background: 'radial-gradient(ellipse at center, rgb(var(--color-primary) / 0.2) 0%, transparent 70%)',
          }}
        />
        {/* Center — subtle warmth (light mode only) */}
        <div className="absolute top-[30%] left-[40%] w-[30%] h-[30%] rounded-full bg-gradient-to-t from-white/60 to-transparent dark:hidden blur-[100px]" />
      </div>

      {/* 2b. Vignette — focuses attention toward center */}
      <div className="absolute inset-0 pointer-events-none z-[1]"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.07) 100%)' }}
      ></div>

      {/* 3. Premium Grain/Noise Overlay */}
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.4] dark:opacity-[0.25] mix-blend-overlay">
        <filter id="noiseFilter">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noiseFilter)" />
      </svg>
      
      <Navbar />
      <main className="flex-1 px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6 lg:px-12 lg:py-7 xl:px-16 xl:py-8 overflow-auto text-gray-800 dark:text-gray-100 relative z-10 w-full max-w-[1600px] mx-auto">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
