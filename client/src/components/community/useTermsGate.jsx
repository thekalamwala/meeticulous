import { useState } from 'react';
import TermsDialog from './TermsDialog';
import { isTermsRequired } from './communityErrors';

// const [guard, termsDialog] = useTermsGate();  await guard(() => createItem(...));
// A write that hits COMMUNITY_TERMS_REQUIRED waits for the dialog: Accept retries it exactly
// once; "Not now" rejects with {cancelled: true} (callers ignore that, nothing was written).
export default function useTermsGate() {
  const [pending, setPending] = useState(null);

  const guard = async (write) => {
    try {
      return await write();
    } catch (e) {
      if (!isTermsRequired(e)) throw e;
      return new Promise((resolve, reject) => setPending({ write, resolve, reject }));
    }
  };

  const dialog = pending && (
    <TermsDialog
      onClose={() => { pending.reject({ cancelled: true }); setPending(null); }}
      onAccepted={async () => {
        const p = pending;
        setPending(null);
        try { p.resolve(await p.write()); } catch (e) { p.reject(e); }
      }}
    />
  );
  return [guard, dialog];
}
