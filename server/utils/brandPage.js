// brandPage.js — self-contained branded HTML for the API host's browser-facing
// pages (root, 404, thrown errors, /status). API/JSON clients never see this —
// see wantsBrandedHtml. Dependency-free + inline so it works on the API-only
// server (no view engine, no static dir).
//
// Look: dark "hacker terminal" — a crimson matrix-rain backdrop behind a mock
// terminal window. One shared shell drives all four pages. Brand: Meeticulous,
// crimson #960D32; JetBrains Mono for terminal text, Plus Jakarta Sans wordmark.
const SITE = 'https://meeticulous.com';
const SUPPORT = 'mailto:support@meeticulous.com';

// Error hero: the Meeticulous mark (crimson rounded square + white zap), inline
// so it has no external dependency. Replaces the old mascot PNGs that
// hung off a dead legacy asset host.
function heroMark() {
  return `<svg class="heromark" viewBox="0 0 96 96" role="img" aria-label="Meeticulous" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="88" height="88" rx="22" fill="var(--crimson)"/><g transform="translate(28 28) scale(1.667)" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></g></svg>`;
}

// Minimal HTML-escape for any dynamic text dropped into the template (error
// messages can contain user input). Prevents the branded page from becoming an
// XSS vector when `expose` error messages are shown.
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Crimson-on-near-black terminal theme. --crimson is the brand fill; --accent is
// a lighter crimson that stays legible as text/glyphs on the dark background.
const CSS = `
  :root{--bg:#0a0a0e;--panel:#111119;--crimson:#960D32;--accent:#e8426e;--text:#e9e9f0;--muted:#8d8d9b;--line:rgba(255,255,255,.08);--ok:#37d67a;--bad:#ff4d4d}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{background:var(--bg);color:var(--text);font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-height:100%;display:grid;place-items:center;padding:24px;overflow-x:hidden}
  #rain{position:fixed;inset:0;width:100%;height:100%;z-index:0;opacity:.5;pointer-events:none}
  .scene{position:relative;z-index:1;width:100%;max-width:620px}
  /* terminal window */
  .term{background:linear-gradient(180deg,rgba(17,17,25,.96),rgba(10,10,14,.96));border:1px solid var(--line);border-radius:10px;overflow:hidden;box-shadow:0 30px 80px -30px rgba(0,0,0,.8),0 0 0 1px rgba(150,13,50,.15),0 0 60px -20px rgba(150,13,50,.4);backdrop-filter:blur(2px)}
  .bar{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02)}
  .dots{display:flex;gap:7px}
  .dots i{width:11px;height:11px;border-radius:50%;display:block}
  .dots i:nth-child(1){background:#ff5f57}.dots i:nth-child(2){background:#febc2e}.dots i:nth-child(3){background:#28c840}
  .tt{font-size:12px;color:var(--muted);letter-spacing:.02em}
  .screen{padding:30px 26px 32px}
  /* brand wordmark */
  .brandwrap{display:flex;align-items:center;gap:11px;margin-bottom:22px}
  .mark{width:34px;height:34px;border-radius:9px;background:var(--crimson);display:grid;place-items:center;flex:0 0 auto;box-shadow:0 6px 18px -6px rgba(150,13,50,.8)}
  .mark svg{width:19px;height:19px}
  .brand{font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-weight:800;font-size:19px;letter-spacing:-.02em}
  .brand .api{color:var(--accent);font-weight:700;margin-left:7px}
  /* terminal lines */
  .ln{font-size:14px;line-height:1.9;white-space:pre-wrap;word-break:break-word}
  .pr{color:var(--accent)}
  .pr .path{color:var(--muted)}
  .cmd{color:var(--text)}
  .out{color:var(--muted);font-size:14px;line-height:1.9}
  .out b{color:var(--text);font-weight:600}
  .ok-t{color:var(--ok)}.bad-t{color:var(--bad)}
  .cursor{display:inline-block;width:9px;height:1.1em;vertical-align:-2px;background:var(--accent);margin-left:3px;animation:blink 1.05s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
  .code{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin:0 0 10px;font-weight:700}
  h1{font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-weight:800;font-size:clamp(26px,5vw,38px);line-height:1.12;letter-spacing:-.025em;margin:0 0 14px}
  h1 .accent{color:var(--accent)}
  p{color:var(--muted);font-size:14px;line-height:1.7;margin:0 0 24px}
  /* inline Meeticulous mark shown on error pages */
  .heromark{display:block;margin:0 auto 20px;width:92px;height:92px;filter:drop-shadow(0 12px 26px rgba(150,13,50,.5))}
  /* status rows */
  .rows{margin:4px 0 24px;border:1px solid var(--line);border-radius:9px;overflow:hidden}
  .row{display:flex;align-items:center;gap:11px;padding:13px 15px;font-size:13.5px}
  .row + .row{border-top:1px solid var(--line)}
  .row .val{margin-left:auto;font-weight:600;color:var(--text)}
  .dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
  .dot.ok{background:var(--ok);box-shadow:0 0 10px -1px var(--ok)}
  .dot.bad{background:var(--bad);box-shadow:0 0 10px -1px var(--bad)}
  /* actions */
  .cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}
  .btn{display:inline-flex;align-items:center;gap:8px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px;text-decoration:none;transition:transform .15s,box-shadow .15s,opacity .15s}
  .btn svg{width:16px;height:16px}
  .btn.primary{background:var(--crimson);color:#fff;box-shadow:0 12px 26px -12px rgba(150,13,50,.9)}
  .btn.primary:hover{transform:translateY(-2px);box-shadow:0 18px 34px -14px rgba(150,13,50,1)}
  .btn.ghost{background:transparent;color:var(--text);border:1px solid rgba(232,66,110,.35)}
  .btn.ghost:hover{border-color:var(--accent);color:var(--accent)}
  .foot{margin-top:22px;text-align:center;font-size:12px;color:var(--muted)}
  @media (max-width:560px){.screen{padding:24px 18px 26px}.ln,.out{font-size:13px}}
  @media (prefers-reduced-motion: reduce){#rain{display:none}.cursor{animation:none}}
`;

// The crimson matrix-rain backdrop. Inline, dependency-free, self-guarding:
// no-ops on prefers-reduced-motion, missing canvas, or any runtime error, so a
// failure here can never blank the page it decorates.
const RAIN_JS = `
<canvas id="rain" aria-hidden="true"></canvas>
<script>
(function(){
  try{
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var c=document.getElementById('rain');if(!c||!c.getContext)return;
    var x=c.getContext('2d'),fs=15,cols,drops;
    var g='01ｱｶｻﾀﾅﾊﾏﾔﾗﾜﾝﾘﾈ日ﾂ</>$_01'.split('');
    function size(){c.width=innerWidth;c.height=innerHeight;cols=Math.ceil(c.width/fs);drops=[];for(var i=0;i<cols;i++)drops[i]=Math.random()*-60;}
    size();addEventListener('resize',size);
    function draw(){
      x.fillStyle='rgba(10,10,14,0.09)';x.fillRect(0,0,c.width,c.height);
      x.font=fs+"px 'JetBrains Mono',monospace";
      for(var i=0;i<cols;i++){
        var y=drops[i]*fs;
        x.fillStyle=Math.random()>0.985?'#ff7aa6':'rgba(150,13,50,'+(0.45+Math.random()*0.5)+')';
        x.fillText(g[Math.floor(Math.random()*g.length)],i*fs,y);
        if(y>c.height&&Math.random()>0.975)drops[i]=0;
        drops[i]+=0.5+Math.random()*0.5;
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }catch(e){}
})();
</script>`;

const ZAP = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>`;
const ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`;

// A shell prompt line, e.g.  meeticulous@api ~ % whoami
function prompt(cmd) {
  return `<div class="ln"><span class="pr">meeticulous@api <span class="path">~</span> %</span> <span class="cmd">${esc(cmd)}</span></div>`;
}

// Shared page shell: dark <head> + rain backdrop + terminal window. Callers
// supply the terminal `screen` markup; `title` sets the tab title.
function shell({ title = 'Meeticulous', screen = '', barTitle = 'meeticulous@api — ~' } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0a0a0e">
<title>${esc(title)} · Meeticulous</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
  ${RAIN_JS}
  <div class="scene">
    <main class="term">
      <div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="tt">${esc(barTitle)}</span></div>
      <div class="screen">${screen}</div>
    </main>
    <div class="foot">Meeticulous API · api.meeticulous.com</div>
  </div>
</body>
</html>`;
}

// Brand wordmark (crimson zap mark + "Meeticulous API"). Shared across pages.
function wordmark() {
  return `<div class="brandwrap"><span class="mark">${ZAP}</span><span class="brand">Meeticulous<span class="api">API</span></span></div>`;
}

// Single-message page (root, 404, errors). Rendered as terminal output: the code
// + heading read as an error line, the body as the explanation, with an optional
// framed mascot and a CTA back to the app.
function brandPage({ code = '', title = 'Meeticulous', heading = '', body = '', ctaLabel = 'Open app', ctaHref = SITE, hero = false } = {}) {
  const screen =
    wordmark() +
    `${hero ? heroMark() : ''}` +
    `${code ? `<div class="code">Error ${esc(code)}</div>` : ''}` +
    `<h1>${esc(heading)}</h1>` +
    `<p>${esc(body)}</p>` +
    `<div class="cta">` +
      `<a class="btn primary" href="${esc(ctaHref)}">${esc(ctaLabel)} ${ARROW}</a>` +
      `<a class="btn ghost" href="/status">System status</a>` +
    `</div>`;
  return shell({ title, screen });
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
  const screen =
    wordmark() +
    prompt('systemctl status') +
    `<div class="code">System status</div>` +
    `<h1>${db ? 'All systems operational' : 'Partial outage'}</h1>` +
    `<div class="rows">` +
      `<div class="row">${dot(true)}<span>API</span><span class="val ok-t">Operational</span></div>` +
      `<div class="row">${dot(db)}<span>Database</span><span class="val ${db ? 'ok-t' : 'bad-t'}">${db ? 'Ready' : 'Unreachable'}</span></div>` +
      `<div class="row">${dot(true)}<span>Uptime</span><span class="val">${esc(fmtUptime(uptimeSec))}</span></div>` +
    `</div>` +
    `<div class="cta"><a class="btn primary" href="${SITE}">Open app ${ARROW}</a></div>`;
  return shell({ title: 'Status', screen, barTitle: 'meeticulous@api — status' });
}

// ── API home page (served at `/` to browsers) ──────────────────────────────
// The API host's front door (api.meeticulous.com). Honest: there is no public
// API / key / docs yet, so this is a branded "engine room" landing, not a dev
// portal. Terminal output + the shared crimson matrix-rain backdrop.
function apiHomePage() {
  const screen =
    wordmark() +
    prompt('whoami') +
    `<div class="out">→ <b>Meeticulous API</b> · the booking engine behind meeticulous.com</div>` +
    prompt('status') +
    `<div class="out">→ <span class="ok-t">● online</span>   region: singapore   0% commission booking</div>` +
    `<div class="ln"><span class="pr">meeticulous@api <span class="path">~</span> %</span> <span class="cursor"></span></div>` +
    `<h1>You found the <span class="accent">engine room.</span></h1>` +
    `<p>This is the API host that powers bookings, payments and accounts. Nothing to see here — the app lives next door.</p>` +
    `<div class="cta">` +
      `<a class="btn primary" href="${SITE}">Open app ${ARROW}</a>` +
      `<a class="btn ghost" href="/status">System status</a>` +
      `<a class="btn ghost" href="${SUPPORT}">Support</a>` +
    `</div>`;
  return shell({ title: 'Meeticulous API', screen });
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

module.exports = { brandPage, apiHomePage, statusPage, wantsBrandedHtml };
