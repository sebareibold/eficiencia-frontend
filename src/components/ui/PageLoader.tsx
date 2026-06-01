import { memo } from 'react'
import { motion } from 'framer-motion'

const PageLoader = memo(function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
      />
    </div>
  )
})

export default PageLoader
