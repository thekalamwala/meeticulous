/**
 * Boot-time environment validation.
 *
 * Previously the server booted with whatever env it had and only failed later,
 * at request time, with cryptic errors deep inside a controller (a missing
 * OAUTH_STATE_SECRET surfaced as a Google-login 500; a missing CLIENT_URL
 * silently disabled the prod CORS lock). This consolidates the checks into one
 * fail-fast report at startup.
 *
 * Behaviour:
 *   - production : a missing CRITICAL var aborts the boot with a single
 *                  aggregated message (better a clean crash on deploy than a
 *                  half-working service that 500s real users).
 *   - dev / test : never throws — only warns — so local dev and CI unit tests
 *                  (which boot with a minimal env) keep working.
 *   - always     : warns on missing RECOMMENDED vars (a feature degrades, but
 *                  the core app still runs).
 *
 * Note: config/supabase.js still does its own deeper check that the
 * service-role key is actually a service_role JWT (not just present). This
 * validator runs first and catches the "missing entirely" case with full context.
 */

// Vars without which core flows or security guarantees break.
const CRITICAL = [
  ['SUPABASE_URL',             'Supabase project URL — every DB call fails without it.'],
  ['SUPABASE_SERVICE_ROLE_KEY','Service-role key — all RLS-bypassing writes fail.'],
  ['SUPABASE_ANON_KEY',        'Anon key — user-context auth (sign-in helper) fails.'],
  ['SUPER_ADMIN_JWT_SECRET',   'Admin JWT signing secret — admin auth is insecure/broken.'],
  ['OAUTH_STATE_SECRET',       'Signs the Google OAuth state param — login CSRF guard.'],
  ['GOOGLE_TOKEN_KEY',         'Encrypts stored Google tokens at rest.'],
  ['CLIENT_URL',               'Locks prod CORS to your domain — missing = open CORS.'],
];

// Vars whose absence degrades a feature but does not break the core app.
const RECOMMENDED = [
  ['SUPABASE_JWT_SECRET',  'Verifying Supabase-issued JWTs.'],
  ['GOOGLE_CLIENT_ID',     'Google OAuth / Calendar.'],
  ['GOOGLE_CLIENT_SECRET', 'Google OAuth / Calendar.'],
  ['GOOGLE_REDIRECT_URI',  'Google OAuth callback.'],
  ['SMTP_HOST',            'Outbound email (queue worker).'],
  ['SMTP_USER',            'Outbound email auth.'],
  ['SMTP_PASS',            'Outbound email auth.'],
  ['ADMIN_ALERT_EMAIL',    'Admin notifications (e.g. new-category suggestions).'],
  ['PITCH_DECK_PASSCODE',  'Investor pitch deck access (unset = /pitch-deck gate closed / 503).'],
  ['PITCH_DECK_EXPIRES_AT','Investor pitch deck expiry (ISO date; unset = never expires).'],
  // Razorpay keys are admin-managed in the DB (razorpayConfig.js) with env as a
  // fallback, so they are recommended-not-critical here.
  ['RAZORPAY_KEY_ID',      'Razorpay fallback (admin DB config preferred).'],
  ['RAZORPAY_KEY_SECRET',  'Razorpay fallback (admin DB config preferred).'],
];

const isMissing = (name) => {
  const v = process.env[name];
  return v === undefined || String(v).trim() === '';
};

/**
 * @param {{ exitOnFail?: boolean }} [opts] - override prod throw behaviour (tests).
 * @returns {{ missingCritical: string[], missingRecommended: string[] }}
 */
function validateEnv(opts = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const exitOnFail = opts.exitOnFail ?? isProd;

  const missingCritical = CRITICAL.filter(([name]) => isMissing(name)).map(([name]) => name);
  const missingRecommended = RECOMMENDED.filter(([name]) => isMissing(name)).map(([name]) => name);

  if (missingRecommended.length) {
    const lines = RECOMMENDED
      .filter(([name]) => missingRecommended.includes(name))
      .map(([name, why]) => `  - ${name}: ${why}`);
    // eslint-disable-next-line no-console
    console.warn(`[env] Missing recommended vars (feature(s) degraded):\n${lines.join('\n')}`);
  }

  if (missingCritical.length) {
    const lines = CRITICAL
      .filter(([name]) => missingCritical.includes(name))
      .map(([name, why]) => `  - ${name}: ${why}`);
    const msg = `[env] Missing CRITICAL environment variables:\n${lines.join('\n')}`;
    if (exitOnFail) {
      throw new Error(`${msg}\nRefusing to boot in production with an incomplete environment.`);
    }
    // eslint-disable-next-line no-console
    console.warn(`${msg}\n(Non-production: warning only — the app may misbehave.)`);
  }

  return { missingCritical, missingRecommended };
}

module.exports = { validateEnv, CRITICAL, RECOMMENDED };
