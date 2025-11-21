/**
 * Shared Framer Motion animation variants
 * Following glassmorphism design system principles
 */

// Carousel slide transitions
export const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
};

// Pagination dots container (with stagger effect)
export const paginationDotsContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// Individual pagination dot states
export const paginationDot = {
  inactive: {
    scale: 1,
    opacity: 0.4,
  },
  active: {
    scale: 1.2,
    opacity: 1,
  },
};

// Navigation chevron animations (with rotation)
// Pass shouldReduceMotion from useReducedMotion() hook
export const createChevronAnimations = (shouldReduceMotion = false, direction = 'left') => ({
  whileHover: {
    scale: shouldReduceMotion ? 1 : 1.1,
    rotate: shouldReduceMotion ? 0 : (direction === 'left' ? -5 : 5),
  },
  whileTap: {
    scale: shouldReduceMotion ? 1 : 0.95,
  },
});

// Interactive button animations (general purpose)
export const createButtonAnimations = (shouldReduceMotion = false) => ({
  whileHover: {
    scale: shouldReduceMotion ? 1 : 1.1,
  },
  whileTap: {
    scale: shouldReduceMotion ? 1 : 0.95,
  },
});

// Interactive dot animations (pagination dots on hover/tap)
export const createDotAnimations = (shouldReduceMotion = false) => ({
  whileHover: {
    scale: shouldReduceMotion ? 1 : 1.3,
  },
  whileTap: {
    scale: shouldReduceMotion ? 1 : 0.9,
  },
});

// Spring transition presets
export const transitions = {
  // Default spring transition for most interactions
  default: {
    type: 'spring',
    stiffness: 400,
    damping: 17,
  },
  // Smooth spring for carousel slides
  smooth: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  },
  // Snappy spring for pagination dots
  snappy: {
    type: 'spring',
    stiffness: 500,
    damping: 30,
  },
};

// Swipe detection helpers
export const SWIPE_CONFIG = {
  confidenceThreshold: 10000,
  velocityMultiplier: 1,
};

export const calculateSwipePower = (offset, velocity) => {
  return Math.abs(offset) * velocity * SWIPE_CONFIG.velocityMultiplier;
};
