import { needsReason, STATUS_LABEL } from './salesConstants';
import { crmSetStatus } from '../../../services/api';

// Change a lead's stage from the table / lead-panel surfaces. The pipeline board
// has its own richer ReasonModal; here we keep it lightweight — a prompt captures
// the reason a guarded (backward or exit) move requires, mirroring the server guard.
//
// Returns true on success, false if the user cancelled the reason prompt. Throws on
// an API error (the caller shows its own toast + revert).
export async function guardedSetStatus(id, from, to) {
  let reason;
  if (needsReason(from, to)) {
    const ask = (typeof window !== 'undefined' && window.prompt)
      ? window.prompt(`Reason to move ${STATUS_LABEL[from] || from} → ${STATUS_LABEL[to] || to}?`)
      : '';
    if (!ask || !ask.trim()) return false;   // cancelled / empty → no move
    reason = ask.trim();
  }
  await crmSetStatus(id, to, reason);         // reason stays undefined when not needed
  return true;
}
