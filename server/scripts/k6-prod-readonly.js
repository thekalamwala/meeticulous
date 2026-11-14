/*
 * k6-prod-readonly.js — SAFE prod load test for the Render origin.
 *
 * WHY these paths only: server/middleware/ipGuard.js EXEMPT_PREFIXES =
 * ['/api/payment/webhook','/health','/prerender','/sitemap','/api/blogs'].
 * offenseTracker skips them, so hammering them from one IP does NOT auto-ban
 * us (any OTHER public path would 403 this runner within seconds). We hit
 * meeticulous-api.onrender.com DIRECTLY (not via Vercel) to measure the bare
 * Render free-tier origin ceiling — the number Cloudflare/edge-cache protects.
 *
 * No writes, no auth, no side effects (no mail/WA/Razorpay/DB writes).
 *
 *   /health     → raw request-handling throughput (no DB)
 *   /api/blogs  → public API w/ 5-min in-process cache (cacheable-spike path)
 *   /sitemap.xml→ cached 6h edge (crawler-spike path)
 *
 * Run (bash):  BASE=https://meeticulous-api.onrender.com k6 run server/scripts/k6-prod-readonly.js
 * Pin the ceiling higher by raising PEAK; keep it modest on a shared prod box.
 *
 * ponytail: single-IP load caps at what one machine+k6 can emit (~a few k RPS);
 * if the knee isn't found, run from 2-3 machines or a k6 cloud runner.
 */
import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE = __ENV.BASE || 'https://meeticulous-api.onrender.com';
const PEAK = parseInt(__ENV.PEAK || '300', 10); // max concurrent VUs

const errRate = new Rate('errors');
const healthT = new Trend('t_health', true);
const blogsT = new Trend('t_blogs', true);
const sitemapT = new Trend('t_sitemap', true);

export const options = {
  // Ramp up through widening load so we can read WHERE latency/errors break,
  // not just pass/fail. Short total (~4.5 min) — responsible on a prod box.
  stages: [
    { duration: '30s', target: Math.round(PEAK * 0.1) }, // warm (beat cold-start spin-up)
    { duration: '45s', target: Math.round(PEAK * 0.33) },
    { duration: '45s', target: Math.round(PEAK * 0.66) },
    { duration: '60s', target: PEAK },                    // peak — the spike
    { duration: '30s', target: PEAK },                    // hold at peak
    { duration: '30s', target: 0 },                       // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'],       // <2% errors = healthy
    'http_req_duration{p:95}': ['p(95)<1500'],
    errors: ['rate<0.02'],
  },
  // Treat a slow/failed response as the ceiling signal, don't abort the run.
  noConnectionReuse: false,
};

export default function () {
  group('health', () => {
    const r = http.get(`${BASE}/health`, { tags: { ep: 'health' } });
    healthT.add(r.timings.duration);
    const ok = check(r, { 'health 200': (x) => x.status === 200 });
    errRate.add(!ok);
  });

  group('blogs', () => {
    const r = http.get(`${BASE}/api/blogs`, { tags: { ep: 'blogs' } });
    blogsT.add(r.timings.duration);
    const ok = check(r, {
      'blogs 200': (x) => x.status === 200,
      'blogs not banned': (x) => x.status !== 403, // sanity: exemption holding
    });
    errRate.add(!ok);
  });

  group('sitemap', () => {
    const r = http.get(`${BASE}/sitemap.xml`, { tags: { ep: 'sitemap' } });
    sitemapT.add(r.timings.duration);
    const ok = check(r, { 'sitemap 200': (x) => x.status === 200 });
    errRate.add(!ok);
  });
}

export function handleSummary(data) {
  // Also drop a JSON next to the script for the blog post's graphs.
  return {
    stdout: textSummary(data),
    'server/scripts/k6-prod-readonly.summary.json': JSON.stringify(data, null, 2),
  };
}

// Minimal inline summary (avoid pulling k6's remote summary module).
function textSummary(data) {
  const m = data.metrics;
  const g = (name, field = 'value') => (m[name] ? m[name].values[field] : undefined);
  const line = (label, v, unit = '') => `  ${label.padEnd(22)} ${v == null ? '-' : (typeof v === 'number' ? v.toFixed(1) : v)}${unit}`;
  return [
    '',
    '=== k6 prod read-only summary ===',
    line('requests', g('http_reqs', 'count')),
    line('rps (avg)', g('http_reqs', 'rate'), '/s'),
    line('err rate', (g('http_req_failed', 'rate') ?? 0) * 100, '%'),
    line('dur p95', m.http_req_duration?.values['p(95)'], 'ms'),
    line('dur p99', m.http_req_duration?.values['p(99)'], 'ms'),
    line('dur max', m.http_req_duration?.values.max, 'ms'),
    line('health p95', m.t_health?.values['p(95)'], 'ms'),
    line('blogs p95', m.t_blogs?.values['p(95)'], 'ms'),
    line('sitemap p95', m.t_sitemap?.values['p(95)'], 'ms'),
    '',
  ].join('\n');
}
