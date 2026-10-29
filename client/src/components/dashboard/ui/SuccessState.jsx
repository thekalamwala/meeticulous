import { motion } from 'framer-motion';
import { cn } from './cn';

// Committed-action confirmation with a drawn checkmark. Use after money/save
// actions instead of a fleeting success toast.
export function SuccessState({ title = 'Done', message, action, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" strokeWidth="3">
          <motion.path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          />
        </svg>
      </motion.div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-gray-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default SuccessState;
