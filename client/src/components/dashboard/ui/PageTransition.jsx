import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// Slide-in push transition for host dashboard route changes. Keyed on
// pathname so each navigation animates in/out.
//
// CONSEQUENCE: the key change unmounts everything below this on every
// navigation, once the exit animation finishes. So a multi-step flow whose
// parent route element renders inside DashboardLayout must NOT hold its state
// here — mount the provider ABOVE the layout, in the route element in App.jsx
// (see /dashboard/kyc/flow). A provider left below this remounts empty on each
// step, and a step guard reading it will bounce the user back to step one.
// Note the remount is invisible until the 180ms exit completes: a test that
// asserts immediately after navigating passes anyway.
export function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default PageTransition;
