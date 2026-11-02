// Production CORS allowlist.
//
// The app is served by Vercel on several live hostnames at once (apex
// `meeticulous.com`, `www.meeticulous.com`, and the `*.vercel.app` alias). The
// previous lock matched ONE exact CLIENT_URL, so visitors who landed on `www.`
// (or an old vercel link) loaded a normal-looking site whose every /api call
// was CORS-rejected — the "Sign in with Google does nothing / button doesn't
// move" report. To stop that class of bug:
//
//   - CLIENT_URL          : the canonical origin (unchanged).
//   - CLIENT_URLS         : optional comma-separated extra origins (e.g. the
//                           vercel.app alias) for hosts we can't sibling-derive.
//   - and for every origin above we auto-include its www/apex SIBLING, so
//     meeticulous.com ⇄ www.meeticulous.com both pass with no extra config.

const stripSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

// https://www.example.com → https://example.com, and vice versa.
// Returns null for anything that isn't a parseable absolute origin.
const sibling = (origin) => {
  try {
    const u = new URL(origin);
    u.hostname = u.hostname.startsWith('www.')
      ? u.hostname.slice(4)
      : `www.${u.hostname}`;
    return stripSlash(u.origin);
  } catch {
    return null;
  }
};

// Build the set of allowed origins from env (CLIENT_URL + CLIENT_URLS + their
// www/apex siblings). Trailing slashes are normalised away so a stray
// "https://meeticulous.com/" still matches.
const buildAllowedOrigins = (env = process.env) => {
  const raw = [env.CLIENT_URL, ...String(env.CLIENT_URLS || '').split(',')]
    .map(stripSlash)
    .filter(Boolean);

  const set = new Set();
  for (const o of raw) {
    set.add(o);
    const sib = sibling(o);
    if (sib) set.add(sib);
  }
  return set;
};

module.exports = { buildAllowedOrigins, sibling, stripSlash };
