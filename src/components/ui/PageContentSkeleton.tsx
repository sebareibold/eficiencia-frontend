import Skeleton from './Skeleton'

export default function PageContentSkeleton() {
  return (
    <div className="space-y-5 md:space-y-7 animate-pulse-subtle">

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

      {/* Contenido principal */}
      <div className="rounded-[2rem] border border-white/50 dark:border-white/10 bg-white/30 dark:bg-black/30 backdrop-blur-3xl p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
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
  )
}
