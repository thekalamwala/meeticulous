/**
 * background.js — fire-and-forget best-effort tasks that run AFTER the HTTP
 * response is sent, so slow side-effects (email, WhatsApp, analytics, ledger)
 * never block the user-facing latency.
 *
 * Contract:
 *   - Call ONLY after res.json()/res.send() — the request is already answered.
 *   - The task MUST be best-effort: a failure (or a process crash before it
 *     runs) is logged, never surfaced to the client. Do NOT use this for work
 *     whose result the response depends on, or for money-state transitions.
 *   - Single always-on Render instance: a task lost to a crash is acceptable
 *     for side-effects that already swallow their own errors today.
 */
const { logger } = require('./logger');

// Defer to the next tick so res.json() flushes before the task starts.
const runInBackground = (label, fn) => {
  setImmediate(() => {
    Promise.resolve()
      .then(fn)
      .catch((err) => {
        logger.error({
          type: 'BACKGROUND_TASK_ERROR',
          label,
          message: err?.message,
          stack: err?.stack,
        });
      });
  });
};

module.exports = { runInBackground };
