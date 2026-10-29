/**
 * opsController.js — operational probes.
 *
 * /ready   — readiness probe that DOES touch the DB (a cheap, timeout-guarded
 *            HEAD/count), unlike /health which stays DB-free so a slow Supabase
 *            round-trip can't flap the platform health check. Use /ready to gate
 *            traffic/deploys ("is this instance able to serve DB-backed
 *            requests?"); use /health for pure liveness.
 * /metrics — Prometheus text exposition, token-gated. Returns 404 unless
 *            METRICS_TOKEN is set (opt-in, so process internals are never
 *            exposed by default); when set, requires a matching bearer token or
 *            ?token=.
 */
const { supabaseAdmin } = require('../config/supabase');
const metrics = require('../utils/metrics');

const READY_TIMEOUT_MS = Number(process.env.READY_DB_TIMEOUT_MS) || 2000;

// Cheap, timeout-guarded DB reachability check. Shared by /ready (JSON probe)
// and the human /status page. Never throws — resolves { ready, error? }.
const checkDbReady = async () => {
  try {
    // HEAD + count on a small always-present table.
    const check = supabaseAdmin
      .from('subscription_plans')
      .select('id', { head: true, count: 'exact' })
      .limit(1);
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('db check timed out')), READY_TIMEOUT_MS),
    );
    const result = await Promise.race([check, timeout]);
    if (result && result.error) throw result.error;
    return { ready: true };
  } catch (err) {
    return { ready: false, error: err.message };
  }
};

const readiness = async (req, res) => {
  const { ready, error } = await checkDbReady();
  if (ready) return res.status(200).json({ ready: true, ts: Date.now() });
  // 503 so an orchestrator/uptime check treats this instance as not-ready
  // (e.g. DB unreachable) rather than fully down.
  return res.status(503).json({ ready: false, error });
};

const exposeMetrics = (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (!token) return res.status(404).json({ message: 'Not found' }); // opt-in only
  const provided =
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token;
  if (provided !== token) return res.status(401).json({ message: 'Unauthorized' });

  res.set('Content-Type', 'text/plain; version=0.0.4');
  return res.status(200).send(metrics.render());
};

module.exports = { readiness, exposeMetrics, checkDbReady };
