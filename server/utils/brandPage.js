// brandPage.js — self-contained branded HTML for the API host's browser-facing
// pages (root, 404, thrown errors, /status). API/JSON clients never see this —
// see wantsBrandedHtml. Dependency-free + inline so it works on the API-only
// server (no view engine, no static dir). Brand: Plus Jakarta Sans headings,
// Poppins body, orange #FE5100 — matches bookasloth.com.
const SITE = 'https://bookasloth.com';

const ERROR_IMAGE_BASE = 'https://company-assets.bookasloth.in/images/error';
const ERROR_IMAGE_VARIANTS = ['sloth-tracks.png', 'sloth-think.png', 'sloth-glass.png'];
function pickErrorImage() {
  const i = Math.floor(Math.random() * ERROR_IMAGE_VARIANTS.length);
  return `${ERROR_IMAGE_BASE}/${ERROR_IMAGE_VARIANTS[i]}`;
}

// Minimal HTML-escape for any dynamic text dropped into the template (error
// messages can contain user input). Prevents the branded page from becoming an
// XSS vector when `expose` error messages are shown.
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const BRAND_CSS = `
  :root { --orange:#FE5100; --ink:#141416; --muted:#5b5b62; --bg:#faf8f5; --card:#fff; --line:#ececec; --ok:#2E9D58; --bad:#dc2626; }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{background:var(--bg);color:var(--ink);font-family:'Poppins',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:grid;place-items:center;padding:24px}
  .card{background:var(--card);border:1px solid var(--line);border-radius:16px;max-width:460px;width:100%;padding:40px 32px;text-align:center;box-shadow:0 10px 40px rgba(20,20,22,.06)}
  .logo{display:inline-flex;align-items:center;gap:10px;margin-bottom:24px}
  .hero{width:132px;height:132px;object-fit:contain;margin:0 auto 20px;display:block}
  .bolt{width:40px;height:40px;border-radius:12px;background:var(--orange);display:grid;place-items:center}
  .bolt svg{width:22px;height:22px}
  .brand{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:18px;letter-spacing:-.01em}
  .code{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--orange);margin-bottom:10px}
  h1{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:26px;line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}
  p{color:var(--muted);font-size:15px;line-height:1.6;margin:0 0 28px}
  a.btn{display:inline-block;background:var(--orange);color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:12px;transition:opacity .15s}
  a.btn:hover{opacity:.9}
  .foot{margin-top:28px;font-size:12px;color:#9a9aa2}
  .rows{text-align:left;margin:8px 0 28px;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .row{display:flex;align-items:center;gap:10px;padding:14px 16px;font-size:14px}
  .row + .row{border-top:1px solid var(--line)}
  .row .val{margin-left:auto;font-weight:600;color:var(--ink)}
  .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
  .dot.ok{background:var(--ok)} .dot.bad{background:var(--bad)}
`;
// Error/status pages are always white (light tokens above, no dark-mode block):
// the detective-sloth 404 art has a white background, so a dark card would frame
// it in a white box. Kept white regardless of OS theme.

// Shared page shell: <head> + brand CSS + logo + footer. Callers supply `inner`.
function shell({ title = 'Book A Sloth', inner = '' } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · Book A Sloth</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@800&family=Poppins:wght@400;500&display=swap" rel="stylesheet">
<style>${BRAND_CSS}</style>
</head>
<body>
  <main class="card">
    <div class="logo">
      <span class="bolt"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg></span>
      <span class="brand">Book A Sloth</span>
    </div>
    ${inner}
    <div class="foot">book-a-sloth API · 0% commission booking</div>
  </main>
</body>
</html>`;
}

// Single-message page (root, 404, errors).
function brandPage({ code = '', title = 'Book A Sloth', heading = '', body = '', ctaLabel = 'Go to Book A Sloth', ctaHref = SITE, image = '' } = {}) {
  const inner =
    `${image ? `<img class="hero" src="${esc(image)}" alt="" width="132" height="132">` : ''}` +
    `${code ? `<div class="code">${esc(code)}</div>` : ''}` +
    `<h1>${esc(heading)}</h1>` +
    `<p>${esc(body)}</p>` +
    `<a class="btn" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>`;
  return shell({ title, inner });
}

function fmtUptime(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

// Human-facing status page. `db` = DB reachability; API is implicitly up (we
// answered). Never consumed by machines — /health and /ready keep their JSON.
function statusPage({ db = true, uptimeSec = 0 } = {}) {
  const dot = (ok) => `<span class="dot ${ok ? 'ok' : 'bad'}"></span>`;
  const inner =
    `<div class="code">System status</div>` +
    `<h1>${db ? 'All systems operational' : 'Partial outage'}</h1>` +
    `<div class="rows">` +
      `<div class="row">${dot(true)}<span>API</span><span class="val">Operational</span></div>` +
      `<div class="row">${dot(db)}<span>Database</span><span class="val">${db ? 'Ready' : 'Unreachable'}</span></div>` +
      `<div class="row">${dot(true)}<span>Uptime</span><span class="val">${esc(fmtUptime(uptimeSec))}</span></div>` +
    `</div>` +
    `<a class="btn" href="${SITE}">Go to Book A Sloth</a>`;
  return shell({ title: 'Status', inner });
}

// ── API home page (served at `/` to browsers) ──────────────────────────────
// Full-bleed two-column landing for the API host (api.meeticulous.com). This is
// the "engine room" developer page, distinct from the centred brandPage card
// used for 404/errors. Dependency-free + inline (API-only server, no static dir).
// The bee mascot is drawn purely from lines + dots (inline SVG) — no raster asset.
const HOME_SITE = 'https://meeticulous.com';
const HOME_DOCS = '/docs';
const HOME_SUPPORT = 'mailto:support@meeticulous.com';

function beeSvg() {
  // Constellation bee: dots (joints) connected by lines. Yellow body + ink lines,
  // striped abdomen, two wings, antennae, and shades — all from <circle>/<line>/<path>.
  return `<svg class="bee" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g stroke="#1b1b1f" stroke-width="2.5" stroke-linecap="round">
    <!-- antennae -->
    <line x1="92" y1="58" x2="80" y2="34"/><line x1="108" y1="58" x2="120" y2="34"/>
    <!-- wings (dotted loops) -->
    <path d="M86 78 Q40 58 44 92 Q58 108 90 96" stroke-dasharray="2 7" opacity=".85"/>
    <path d="M114 78 Q160 58 156 92 Q142 108 110 96" stroke-dasharray="2 7" opacity=".85"/>
    <!-- body stripes -->
    <line x1="80" y1="104" x2="120" y2="104"/>
    <line x1="78" y1="122" x2="122" y2="122"/>
    <line x1="82" y1="140" x2="118" y2="140"/>
    <!-- shades bar -->
    <line x1="86" y1="64" x2="114" y2="64"/>
  </g>
  <!-- body outline -->
  <ellipse cx="100" cy="122" rx="30" ry="40" fill="#F7C948" stroke="#1b1b1f" stroke-width="3"/>
  <!-- head -->
  <circle cx="100" cy="66" r="20" fill="#F7C948" stroke="#1b1b1f" stroke-width="3"/>
  <!-- shades lenses (dots) -->
  <circle cx="91" cy="64" r="6" fill="#1b1b1f"/><circle cx="109" cy="64" r="6" fill="#1b1b1f"/>
  <!-- joint dots -->
  <g fill="#1b1b1f">
    <circle cx="80" cy="34" r="4"/><circle cx="120" cy="34" r="4"/>
    <circle cx="44" cy="92" r="3.5"/><circle cx="156" cy="92" r="3.5"/>
    <circle cx="100" cy="162" r="4"/>
  </g>
  <g fill="#F7C948" stroke="#1b1b1f" stroke-width="2">
    <circle cx="86" cy="78" r="3.5"/><circle cx="114" cy="78" r="3.5"/>
  </g>
</svg>`;
}

const HOME_CSS = `
  :root{--bee:#F7C948;--bee-ink:#E3A008;--ink:#16161a;--muted:#6b6b73;--bg:#fdfbf4;--line:#eceade;--code-bg:#1b2130;--code-line:#8aa0c0;--str:#7ee0a8;--key:#f6c177;}
  *{box-sizing:border-box}
  html,body{margin:0}
  body{background:var(--bg);color:var(--ink);font-family:'Poppins',system-ui,-apple-system,Segoe UI,Roboto,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1180px;margin:0 auto;padding:28px 40px 72px}
  nav{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
  .brandwrap{display:flex;align-items:center;gap:12px}
  .mark{width:40px;height:40px}
  .brand{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:22px;letter-spacing:-.02em}
  .brand .api{color:var(--muted);font-weight:700;margin-left:6px}
  .navlinks{display:flex;align-items:center;gap:30px}
  .navlinks a{color:var(--ink);text-decoration:none;font-weight:500;font-size:15px}
  .navlinks a:hover{color:var(--bee-ink)}
  .pill{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;background:var(--bee);color:#1b1b1f;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:15px;padding:11px 20px;border-radius:10px;text-decoration:none;box-shadow:0 8px 24px -10px rgba(227,160,8,.7);transition:transform .15s,box-shadow .15s}
  .pill svg{width:15px;height:15px}
  .pill:hover{transform:translateY(-1px);box-shadow:0 14px 30px -12px rgba(227,160,8,.8)}
  .grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center;margin-top:84px}
  .eyebrow{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin-bottom:18px}
  h1{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:clamp(44px,6vw,76px);line-height:.98;letter-spacing:-.03em;margin:0 0 26px}
  h1 .accent{color:var(--bee-ink)}
  .lede{color:var(--muted);font-size:19px;line-height:1.55;max-width:30ch;margin:0 0 36px}
  .cta{display:flex;gap:16px;flex-wrap:wrap}
  .btn{display:inline-flex;align-items:center;gap:10px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:16px;padding:16px 26px;border-radius:12px;text-decoration:none;transition:transform .15s}
  .btn svg{width:18px;height:18px}
  .btn.primary{background:var(--bee);color:#1b1b1f;box-shadow:0 12px 28px -12px rgba(227,160,8,.75)}
  .btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
  .btn:hover{transform:translateY(-2px)}
  /* right column */
  .stage{position:relative;min-height:470px}
  .hex{position:absolute;width:120px;height:138px;background:rgba(247,201,72,.16);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
  .hex.a{top:0;left:30%}.hex.b{top:30%;left:2%;width:92px;height:106px;background:rgba(247,201,72,.1)}
  .hex.c{bottom:2%;right:30%;width:150px;height:172px;background:rgba(247,201,72,.08)}
  .bee{position:absolute;left:2%;bottom:18px;width:200px;height:200px;z-index:1;filter:drop-shadow(0 18px 28px rgba(227,160,8,.22))}
  .codecard{position:absolute;right:-8px;top:24px;width:420px;max-width:92%;background:var(--code-bg);border-radius:16px;box-shadow:0 30px 70px -28px rgba(20,24,40,.6);overflow:hidden;z-index:2;font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
  .codebar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px}
  .lights{display:flex;gap:7px}.lights i{width:11px;height:11px;border-radius:50%;display:block}
  .lights .r{background:#ff5f57}.lights .y{background:#febc2e}.lights .g{background:#28c840}
  .copy{color:#9fb0cc;font-size:12px;display:flex;align-items:center;gap:6px}
  pre{margin:0;padding:6px 18px 20px;font-size:13px;line-height:1.7;color:#cdd8ec;white-space:pre;overflow-x:auto}
  pre .c{color:#9fb0cc}pre .s{color:var(--str)}pre .k{color:var(--key)}
  footer{margin-top:72px;color:#a7a79d;font-size:13px}
  @media(max-width:900px){
    .wrap{padding:22px 22px 56px}
    .navlinks{gap:18px}.navlinks a:not(.pill){display:none}
    .grid{grid-template-columns:1fr;gap:12px;margin-top:48px}
    .stage{min-height:auto;margin-top:24px;display:flex;flex-direction:column;align-items:center}
    .bee{position:relative;left:0;bottom:0;width:150px;height:150px}
    .hex{display:none}
    .codecard{position:relative;right:0;top:0;width:100%;margin-top:20px}
    h1{font-size:clamp(40px,12vw,56px)}
  }
`;

function apiHomePage() {
  const iconKey = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 21 2m-4 4 3 3m-6-1 3 3"/></svg>`;
  const iconDoc = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;
  const arrow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`;
  const curl =
`<span class="c">curl</span> https://api.meeticulous.com/v1/ \\
  -H <span class="s">"Authorization: Bearer YOUR_API_KEY"</span> \\
  -H <span class="s">"Content-Type: application/json"</span>
{
  <span class="k">"service_id"</span>: <span class="s">"srv_123"</span>,
  <span class="k">"customer"</span>: {
    <span class="k">"name"</span>: <span class="s">"Aarav Sharma"</span>
  }
}`;
  const inner = `
  <div class="wrap">
    <nav>
      <div class="brandwrap">
        ${beeSvg().replace('class="bee"', 'class="mark"').replace('width:210px;height:210px', '')}
        <span class="brand">Meeticulous<span class="api">API</span></span>
      </div>
      <div class="navlinks">
        <a href="${HOME_DOCS}">Docs</a>
        <a href="/status">Status</a>
        <a href="${HOME_SUPPORT}">Support</a>
        <a class="pill" href="${HOME_SITE}">Get API Key ${arrow}</a>
      </div>
    </nav>

    <section class="grid">
      <div>
        <div class="eyebrow">Meeticulous API</div>
        <h1>You found the<br><span class="accent">engine room.</span></h1>
        <p class="lede">Integrate bookings, users, payments and more into your product with simple, powerful APIs.</p>
        <div class="cta">
          <a class="btn primary" href="${HOME_SITE}">${iconKey} Get API Key ${arrow}</a>
          <a class="btn ghost" href="${HOME_DOCS}">${iconDoc} Read Docs</a>
        </div>
      </div>
      <div class="stage">
        <span class="hex a"></span><span class="hex b"></span><span class="hex c"></span>
        ${beeSvg()}
        <div class="codecard">
          <div class="codebar">
            <div class="lights"><i class="r"></i><i class="y"></i><i class="g"></i></div>
            <span class="copy">Copy</span>
          </div>
          <pre>${curl}</pre>
        </div>
      </div>
    </section>

    <footer>Meeticulous API · bookings, users &amp; payments for your product</footer>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Meeticulous API</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Poppins:wght@400;500&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>${HOME_CSS}</style>
</head>
<body>${inner}</body>
</html>`;
}

// Serve branded HTML only to browsers on non-API, non-ops paths. API clients,
// /api/*, and machine endpoints (health/ready/metrics/robots) keep JSON/plain.
// req.accepts prefers 'json' for `Accept: */*` (curl/fetch), 'html' for browsers.
function wantsBrandedHtml(req) {
  const p = (req && (req.path || req.url)) || '';
  if (p.startsWith('/api')) return false;
  if (['/health', '/ready', '/metrics', '/robots.txt'].includes(p)) return false;
  return typeof req.accepts === 'function' && req.accepts(['json', 'html']) === 'html';
}

module.exports = { brandPage, apiHomePage, statusPage, wantsBrandedHtml, pickErrorImage, ERROR_IMAGE_BASE };
