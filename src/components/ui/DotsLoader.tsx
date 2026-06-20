import { memo } from 'react'
import { motion } from 'framer-motion'

// ── Spring ease — fast out, natural deceleration at peak ─────────────────────
const spring = [0.22, 1, 0.36, 1] as const

interface DotsLoaderProps {
  /** Clases del contenedor externo — controla posicionamiento y alto */
  className?: string
  /** Tamaño de cada punto */
  size?: 'sm' | 'md'
}

const sizeMap = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
}

/**
 * Loader de 3 puntos con squash-and-stretch.
 *
 * Anima solo transform (scaleX, scaleY, y) + opacity → 100% GPU.
 * Spring ease → cada punto se "dispara" hacia arriba y desacelera al tope,
 * igual que una pelota real. Stagger de 100ms → ola fluida, no segmentada.
 */
const DotsLoader = memo(function DotsLoader({
  className = 'flex items-center justify-center min-h-[60vh]',
  size = 'sm',
}: DotsLoaderProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-2">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className={`block rounded-full bg-primary ${sizeMap[size]}`}
            animate={{
              y:       [0, -7, 0],      // bounce vertical — el movimiento principal
              scaleX:  [1, 0.78, 1],    // se achica en X al subir (squash)
              scaleY:  [1, 1.3,  1],    // se alarga en Y al subir (stretch)
              opacity: [0.3, 1, 0.3],   // respira con el movimiento
            }}
            transition={{
              duration: 0.58,           // era 1.2s — ahora 0.58s: snappy sin ser ansioso
              repeat: Infinity,
              delay: i * 0.1,           // era 0.2s — 100ms: ola fluida
              ease: spring,             // era easeInOut — spring: natural
            }}
          />
        ))}
      </div>
    </motion.div>
  )
})

export default DotsLoader
