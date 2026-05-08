/**
 * Skeleton — shimmer loading placeholder
 * Replaces the old animate-pulse with the richer CSS shimmer from motion system.
 * Uses `rounded-xl` by default so it feels consistent with glassmorphic containers.
 */
interface SkeletonProps {
  className?: string
  /** Number of rows to stack (convenience shortcut) */
  rows?: number
}

export default function Skeleton({ className = '', rows }: SkeletonProps) {
  if (rows && rows > 1) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className={`skeleton-shimmer rounded-xl ${i === rows - 1 ? 'w-3/4' : 'w-full'} h-4 ${className}`}
          />
        ))}
      </div>
    )
  }
  return <div className={`skeleton-shimmer rounded-xl ${className}`} />
}

/** Full-width skeleton card placeholder — matches glassmorphic card dimensions */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-[2rem] border border-white/30 dark:border-white/10 bg-white/20 dark:bg-black/20 backdrop-blur-xl p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="skeleton-shimmer h-12 w-12 rounded-2xl" />
      </div>
      <div className="skeleton-shimmer h-9 w-28 rounded-lg mb-2" />
      <div className="skeleton-shimmer h-3 w-20 rounded-md" />
    </div>
  )
}

/** Skeleton for a table row */
export function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className={`skeleton-shimmer h-4 rounded-lg ${i === 0 ? 'w-32' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  )
}
