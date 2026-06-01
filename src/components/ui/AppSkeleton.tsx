import Skeleton from './Skeleton'

export default function AppSkeleton() {
  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-[#fafafa] dark:bg-[#050505]">

      {/* Fondo grid — igual que Layout */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)]" />

      {/* Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[140px] mix-blend-multiply dark:mix-blend-screen"
          style={{ background: 'radial-gradient(ellipse at center, rgb(var(--color-primary) / 0.35) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[160px] mix-blend-multiply dark:mix-blend-screen"
          style={{ background: 'radial-gradient(ellipse at center, rgb(var(--color-primary) / 0.15) 0%, transparent 70%)' }}
        />
      </div>

      {/* Navbar skeleton */}
      <div className="relative z-10 w-full px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Logo / nombre */}
          <Skeleton className="h-8 w-32 rounded-xl" />

          {/* Pill nav — centro */}
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.06]">
            {[80, 64, 72, 60, 68].map((w, i) => (
              <Skeleton key={i} className={`h-7 rounded-xl`} style={{ width: w }} />
            ))}
          </div>

          {/* Avatar usuario */}
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        </div>
      </div>

      {/* Contenido */}
      <main className="flex-1 px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6 lg:px-12 lg:py-7 xl:px-16 xl:py-8 relative z-10 w-full max-w-[1600px] mx-auto">
        <div className="space-y-5 md:space-y-7">

          {/* Header de página */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 lg:w-64" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-32 rounded-2xl" />
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 xl:gap-6">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-4 sm:p-5 xl:p-6 flex flex-col justify-between gap-4 min-h-[120px]"
              >
                <Skeleton className="h-10 w-10 xl:h-12 xl:w-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-7 xl:h-9 w-24" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>

          {/* Tabla / content card */}
          <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-5 md:p-6 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-48 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
            {/* Filas */}
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4 px-2 py-3 rounded-2xl border border-black/[0.04] dark:border-white/[0.04]">
                  <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                  <Skeleton className="h-4 flex-1 max-w-[200px]" />
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-4 w-16 hidden sm:block" />
                  <Skeleton className="h-6 w-16 rounded-full hidden md:block" />
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
