import { motion } from 'framer-motion';

export function AnimatedPage({ children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3, type: 'spring', bounce: 0, damping: 20 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
