// Deterministic priority: Impact(severity) x Confidence x Scope / Effort. Configurable.
const SEV_WEIGHT = { P0: 100, P1: 60, P2: 30, P3: 12, P4: 4 };
const WEIGHTS = { SEV_WEIGHT };
function prioritize(issue, _ctx) {
  const impact = SEV_WEIGHT[issue.severity] ?? 4;
  const confidence = issue.confidence ?? 1;
  const scope = Math.max(1, Number(issue.evidence?.count) || 1);
  const effort = 1; // P1: no effort model yet — tuning knob for later phases
  return { severity: issue.severity, priorityScore: Math.round(impact * confidence * scope / effort * 100) / 100 };
}
module.exports = { prioritize, WEIGHTS };
