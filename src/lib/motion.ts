/**
 * ─── Eficiencia Motion System ───────────────────────────────────────────────
 * Single source of truth for all animation tokens and Framer Motion variants.
 *
 * Rules:
 *  - All durations are in seconds (Framer Motion convention)
 *  - Use transform/opacity only — no layout-thrashing properties
 *  - Delays only when they add clear narrative value (stagger lists)
 *  - Respects prefers-reduced-motion via the `reducedMotion` token
 * ────────────────────────────────────────────────────────────────────────────
 */

// ── Durations ────────────────────────────────────────────────────────────────
export const duration = {
  instant: 0.1,   // micro feedback (click, toggle)
  fast:    0.18,  // hover states, small transitions
  base:    0.25,  // component enter/exit (modal, dropdown)
  slow:    0.4,   // page-level enter
  crawl:   0.6,   // hero / first paint
} as const

// ── Easings ──────────────────────────────────────────────────────────────────
export const ease = {
  spring:    [0.22, 1, 0.36, 1] as const,   // natural spring (default)
  out:       [0, 0, 0.2, 1]    as const,    // standard ease-out
  inOut:     [0.4, 0, 0.2, 1]  as const,    // standard ease-in-out
  overshoot: [0.34, 1.56, 0.64, 1] as const // slight bounce for emphasis
} as const

// ── Stagger helpers ──────────────────────────────────────────────────────────
export const stagger = {
  fast: 0.06,
  base: 0.08,
  slow: 0.12,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// VARIANT PRESETS — import and spread directly into Framer Motion components
// ─────────────────────────────────────────────────────────────────────────────

/** Standard page-level entrance */
export const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: ease.spring },
  },
}

/** Card / bento tile entrance */
export const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.base, ease: ease.spring },
  },
}

/** Stagger container — parent wrapping a list of animated children */
export const staggerContainer = (staggerChildren = stagger.base) => ({
  animate: {
    transition: { staggerChildren },
  },
})

/** List item that fades up — child of staggerContainer */
export const listItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.fast, ease: ease.spring },
  },
}

/** Modal backdrop */
export const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: duration.fast } },
  exit:    { opacity: 0, transition: { duration: duration.fast } },
}

/** Modal panel */
export const modalVariants = {
  initial: { opacity: 0, scale: 0.96, y: 12 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.base, ease: ease.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    transition: { duration: duration.fast, ease: ease.inOut },
  },
}

/** Dropdown / popover */
export const dropdownVariants = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: duration.fast, ease: ease.spring },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -4,
    transition: { duration: duration.instant },
  },
}

/** Toast notification */
export const toastVariants = {
  initial: { opacity: 0, x: 40, scale: 0.95 },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: duration.base, ease: ease.spring },
  },
  exit: {
    opacity: 0,
    x: 40,
    scale: 0.95,
    transition: { duration: duration.fast, ease: ease.inOut },
  },
}

/** Alert / pill badge pop-in */
export const alertVariants = {
  initial: { scale: 0.92, opacity: 0 },
  animate: {
    scale: 1,
    opacity: 1,
    transition: { duration: duration.fast, ease: ease.overshoot },
  },
}
