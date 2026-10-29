// Support team routing. Two teams: CXO owns money + bugs/technical; Support owns
// everything else. Derived from the conversation's subject/summary (no migration) —
// so an agent can filter to their team's queue. Keep in step with the reason
// taxonomy: money reasons (pay_*, host_payout, host_subscription) + product_bug → CXO.
const CXO_RE = /\b(payout|payment|refund|charg(?:e|ed|es)?|invoice|receipt|settle|money|earning|subscription|renew|upgrade|plan|bug|error|broke|not working|glitch|crash|500|failed)\b/i;

export const teamForText = (text) => (CXO_RE.test(text || '') ? 'cxo' : 'support');
export const TEAM_LABEL = { cxo: 'CXO', support: 'Support' };
export const TEAM_FILTERS = [
  { id: 'all', label: 'All teams' },
  { id: 'cxo', label: 'CXO' },
  { id: 'support', label: 'Support' },
];
