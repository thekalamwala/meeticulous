import { useFeature } from '../../context/FeatureContext';

/**
 * FeatureGate — render children only when an admin kill-switch is ON.
 *
 *   <FeatureGate flag="cover_photo">
 *     <CoverPhotoUploader />
 *   </FeatureGate>
 *
 * Optional `fallback` renders when the flag is OFF (default: nothing).
 * Fail-open: unknown/loading flags are treated as ON (see FeatureContext).
 */
export default function FeatureGate({ flag, children, fallback = null }) {
  const on = useFeature(flag);
  return on ? children : fallback;
}
