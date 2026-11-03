import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// Enter-only push transition for host dashboard route changes. Keyed on pathname
// so each navigation mounts a fresh element and plays a quick fade+lift in.
//
// Why no AnimatePresence / exit: `mode="wait"` made every tap wait for the old
// screen to animate OUT (~180ms) BEFORE the new one came in — screens didn't
// change instantly. Dropping the exit means the old page unmounts immediately and
// the new one enters right away, so navigation feels native-snappy.
//
// CONSEQUENCE: the key change still unmounts everything below on every navigation,
// now immediately (no exit delay). A multi-step flow whose provider renders inside
// DashboardLayout must mount that provider ABOVE the layout (see /dashboard/kyc/flow),
// or each step remounts it empty and a step guard bounces the user to step one.
export function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.14, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
