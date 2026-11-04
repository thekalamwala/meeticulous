import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useFeature, useFeatures } from '../context/FeatureContext';

const KEY = 'host_linkedin_login';

// LinkedIn mark (same glyph the host pages already used for the "Soon" buttons).
const LinkedInIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
  </svg>
);

// useFeature keeps the Supreme/kill-switch semantics; the explicit `=== true` makes this opt-in door fail closed when the flag row is missing.
export function useLinkedinEnabled() {
  const on = useFeature(KEY);
  const { flags } = useFeatures();
  return !!on && flags?.[KEY] === true;
}

// Secondary host sign-in/up option beside the Google button. Renders nothing unless
// the admin flag is explicitly ON — the shared flag map fails OPEN for unknown
// keys, but this door fails CLOSED (matches the server), so we also require an
// explicit `true` row. `onStart` runs right before the redirect (stash page
// context the OAuth round-trip must survive, e.g. the hero slug or an invite).
export default function ContinueWithLinkedIn({
  intent,
  onStart,
  className = 'btn btn--outline mt-3 flex w-full items-center justify-center gap-3 py-2.5 text-sm font-semibold',
}) {
  const { startLinkedinHostAuth } = useAuth();
  const enabled = useLinkedinEnabled();
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  const click = async () => {
    if (busy) return;
    setBusy(true);
    try {
      onStart?.();
      await startLinkedinHostAuth(intent);
    } catch {
      toast.error("Couldn't start LinkedIn sign-in. Try again.");
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={click} disabled={busy} className={`${className} disabled:opacity-50`}>
      <LinkedInIcon />
      {busy ? 'Opening LinkedIn…' : 'Continue with LinkedIn'}
    </button>
  );
}
