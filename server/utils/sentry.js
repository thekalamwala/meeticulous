// Thin wrapper around @sentry/node.
//
// Two reasons it exists:
//   1. The rest of the app captures errors through here, not the SDK directly,
//      so swapping/removing Sentry is a one-file change.
//   2. Everything NO-OPS cleanly when SENTRY_DSN is unset (local, CI, or a prod
//      that hasn't wired Sentry yet). The SDK is required lazily inside
//      initSentry, so it's only loaded when actually configured — captureException
//      is a safe no-op until then and never throws.

let sentry = null; // the initialized SDK, or null when disabled

/**
 * Initialize Sentry if SENTRY_DSN is set. Safe to call once at boot.
 * @returns {{enabled: boolean}}
 */
function initSentry() {
  if (sentry) return { enabled: true };
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return { enabled: false };
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || undefined,
      // Default 0 = errors only, no perf tracing overhead. Bump via env if wanted.
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    });
    sentry = Sentry;
    return { enabled: true };
  } catch (err) {
    console.error('Sentry init failed (continuing without it):', err.message);
    return { enabled: false };
  }
}

/**
 * Report an error to Sentry. No-op (returns false) when Sentry is disabled.
 * Never throws — error reporting must not create new errors.
 * @param {Error} err
 * @param {object} [context] attached as `extra`
 * @returns {boolean} whether the error was forwarded
 */
function captureException(err, context) {
  if (!sentry) return false;
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
    return true;
  } catch {
    return false;
  }
}

/**
 * Flush buffered events before exit (graceful shutdown / uncaughtException).
 * Best-effort; resolves even if Sentry is disabled or the flush fails.
 */
async function flushSentry(timeoutMs = 2000) {
  if (!sentry || typeof sentry.flush !== 'function') return;
  try { await sentry.flush(timeoutMs); } catch { /* best-effort */ }
}

// Test-only: reset module state between cases.
function _reset() { sentry = null; }

module.exports = { initSentry, captureException, flushSentry, _reset };
