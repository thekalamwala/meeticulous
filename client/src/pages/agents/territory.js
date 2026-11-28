// Territory engine for /agents. Four sprites walk a full-screen tile grid and claim tiles in their
// colour. Once every tile is claimed they steal from each other, so nobody ever finishes the page.
// Plain DOM + one canvas on purpose: React only renders the shell; this runs at 60fps outside it.
import { AGENTS, BODY, PART, PROP_PAL, SHARED, shadow } from './sprites';

/**
 * Claim a round brush of tiles (21 tiles, radius ~2) around tile (c0, r0) for agent `who`.
 * Mutates `own` (tile -> agent index, -1 = unclaimed) and `count` (tiles per agent).
 * Calls onChange(idx) for each tile that changed hands. Pure apart from the callback, so it is unit-tested.
 */
export function claimBrush(own, count, cols, rows, c0, r0, who, onChange = () => {}) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dc * dc + dr * dr > 5) continue;
      const c = c0 + dc;
      const r = r0 + dr;
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const idx = r * cols + c;
      const prev = own[idx];
      if (prev === who) continue;
      if (prev >= 0) count[prev] -= 1; // stealing is what keeps the page from ever being finished
      own[idx] = who;
      count[who] += 1;
      onChange(idx);
    }
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Start the field. Returns stop() which removes every listener, timer and agent node it added.
 * els: { field, canvas, bar, legend } — bar/legend get the live score.
 */
export function startTerritory({ field, canvas, bar, legend }) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers = [];
  const every = (fn, ms) => timers.push(setInterval(fn, ms));
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  let px; let T; let S; let W; let H; let cols = 0; let rows = 0;
  let own = null;
  let count = [0, 0, 0, 0];
  let colors = {};
  let raf = 0;

  const agents = AGENTS.map((cfg, i) => ({ ...cfg, i, blinking: false, glint: false, napUntil: 0, shown: false, tagAt: 0, face: 1 }));
  const pct = (i) => (cols * rows ? (count[i] / (cols * rows)) * 100 : 0);

  // ---- sprites ----
  const updateTag = (a) => {
    a.tag.innerHTML = '';
    const name = document.createElement('b');
    name.style.color = a.ink;
    name.textContent = a.name;
    const share = document.createElement('span');
    share.textContent = `${pct(a.i).toFixed(1)}% of the page`;
    a.tag.append(name, share);
  };

  for (const a of agents) {
    a.el = document.createElement('button');
    a.el.type = 'button';
    a.el.className = `agents-sprite ${a.id}`;
    a.el.setAttribute('aria-label', `${a.name}, ${a.role} agent`);
    a.rig = document.createElement('div');
    a.rig.className = 'agents-rig';
    a.tag = document.createElement('div');
    a.tag.className = 'agents-tag';
    a.dom = {};
    for (const [part, x, y, z, cls = ''] of a.parts) {
      const s = document.createElement('div');
      s.className = `agents-spr ${part} ${cls}`;
      s.style.cssText = `left:${x}em;top:${y}em;z-index:${z}`;
      s.append(document.createElement('i'));
      a.rig.append(s);
      a.dom[part] = a.dom[part] || s.firstChild;
      if (part === 'z') s.firstChild.style.boxShadow = shadow(PART.z, { k: a.ink });
      if (part === 'floor') s.firstChild.style.boxShadow = shadow(PART.floor, SHARED);
      if (part === 'tail') s.firstChild.style.boxShadow = shadow(PART.tail, { ...SHARED, ...PROP_PAL });
    }
    a.el.append(a.rig, a.tag);
    field.append(a.el);
    a.pal = { ...SHARED, ...BODY[a.id].pal };
    a.draw = () => {
      const napping = a.naps && a.napUntil > performance.now();
      const patch = napping
        ? [[6, 13, 'k'], [9, 13, 'k'], [22, 13, 'k'], [25, 13, 'k']] // sleepy ‿ eyes
        : a.sweeps && (a.glint || a.shown) ? [[7, 15, 'G'], [8, 16, 'G'], [24, 15, 'G'], [23, 16, 'G']] : []; // glasses glint
      a.dom.body.style.boxShadow = shadow(BODY[a.id].rows, a.pal, { shut: a.blinking || napping, patch });
      a.dom[a.prop].style.boxShadow = shadow(PART[`${a.prop}${a.shown ? 'On' : ''}`] || PART[a.prop], { ...SHARED, ...PROP_PAL });
      a.el.classList.toggle('napping', napping);
    };
    // Hover / focus / tap shows the name and share of the page.
    let hideTimer = 0;
    const show = (on) => { a.shown = on; a.el.classList.toggle('show', on); updateTag(a); a.draw(); };
    a.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(true); });
    a.el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(false); });
    a.el.addEventListener('focus', () => show(true));
    a.el.addEventListener('blur', () => show(false));
    a.el.addEventListener('click', (e) => { // touch/pen: show for a few seconds while they keep walking
      if (e.pointerType === 'mouse') return;
      show(true);
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => show(false), 2800);
      timers.push(hideTimer);
    });
    a.draw();
  }

  // ---- tiles ----
  const readColors = () => {
    const cs = getComputedStyle(field);
    colors = { bg: cs.getPropertyValue('--agents-bg').trim(), grid: cs.getPropertyValue('--agents-grid').trim(), tint: agents.map((a) => a.color) };
  };
  const drawTile = (idx) => {
    // Claimed tiles fill solid in the agent's body colour; unclaimed ones keep the graph-paper gap.
    const c = idx % cols;
    const r = (idx / cols) | 0;
    const o = own[idx];
    ctx.fillStyle = colors.grid;
    ctx.fillRect(c * T, r * T, T, T);
    if (o < 0) { ctx.fillStyle = colors.bg; ctx.fillRect(c * T + 1, r * T + 1, T - 1, T - 1); } else { ctx.fillStyle = colors.tint[o]; ctx.fillRect(c * T, r * T, T, T); }
  };
  const redrawAll = () => { for (let i = 0; i < own.length; i++) drawTile(i); };

  // ---- layout (re-runs on resize; keeps territory by remapping proportionally) ----
  const minX = () => S * 0.5;
  const maxX = () => Math.max(S * 0.5, W - S * 0.5);
  const minY = () => S * 0.95;
  const maxY = () => Math.max(S * 0.95, H - px);

  const pickRoam = (a) => {
    // Sample random tiles: prefer unclaimed, then rivals', almost never own. Distance weighted by personality.
    const diag = Math.hypot(W, H) || 1;
    let best = [a.x, a.y];
    let bs = Infinity;
    for (let k = 0; k < 28; k++) {
      const c = (Math.random() * cols) | 0;
      const r = (Math.random() * rows) | 0;
      const o = own[r * cols + c];
      const x = (c + 0.5) * T;
      const y = (r + 0.5) * T;
      const s = (o === a.i ? 2.5 : o < 0 ? 0 : 0.6) + (Math.hypot(x - a.x, y - a.y) / diag) * a.reach + Math.random() * 0.2;
      if (s < bs) { bs = s; best = [x, y]; }
    }
    a.tx = clamp(best[0], minX(), maxX());
    a.ty = clamp(best[1], minY(), maxY());
  };
  const pickSweep = (a) => {
    // Tara mows in rows: across, step down, back across. Bored 1 time in 5: roams instead.
    if (Math.random() < 0.2) { pickRoam(a); return; }
    if (a.sweepY == null) { a.sweepY = a.y; a.dir = a.x < W / 2 ? 1 : -1; a.leg = 'across'; }
    if (a.leg === 'across') { a.tx = a.dir > 0 ? maxX() : minX(); a.ty = a.sweepY; a.leg = 'down'; } else {
      a.sweepY += T * 4;
      if (a.sweepY > maxY()) a.sweepY = minY();
      a.dir *= -1; a.tx = a.x; a.ty = a.sweepY; a.leg = 'across';
    }
  };
  const pick = (a, now = performance.now()) => {
    (a.sweeps ? pickSweep : pickRoam)(a);
    a.retargetAt = now + (a.zigzag ? 2500 : 6000);
  };
  const arrive = (a, now) => {
    if (a.naps && Math.random() < 0.35) {
      a.napUntil = now + 1800 + Math.random() * 1800;
      a.draw();
      later(a.draw, a.napUntil - now + 20);
    }
    pick(a, now);
  };

  const setup = () => {
    const old = own; const oc = cols; const or = rows;
    px = parseFloat(getComputedStyle(field).getPropertyValue('--agents-px')) || 4;
    T = px * 4; S = px * 32;
    W = field.clientWidth; H = field.clientHeight;
    cols = Math.max(1, Math.ceil(W / T)); rows = Math.max(1, Math.ceil(H / T));
    own = new Int8Array(cols * rows).fill(-1);
    count = [0, 0, 0, 0];
    if (old && oc && or) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const o = old[Math.min(or - 1, (r * or / rows) | 0) * oc + Math.min(oc - 1, (c * oc / cols) | 0)];
          own[r * cols + c] = o;
          if (o >= 0) count[o] += 1;
        }
      }
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(cols * T * dpr); canvas.height = Math.ceil(rows * T * dpr);
    canvas.style.width = `${cols * T}px`; canvas.style.height = `${rows * T}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    readColors(); redrawAll();
    for (const a of agents) {
      if (a.x == null) continue;
      a.x = clamp(a.x, minX(), maxX()); a.y = clamp(a.y, minY(), maxY());
      a.sweepY = null; pick(a);
    }
  };

  // Every visit starts from the centre; each agent heads for its own quarter first.
  setup();
  const out = [[0.25, 0.3], [0.75, 0.75], [0.75, 0.3], [0.25, 0.75]];
  agents.forEach((a, i) => {
    a.x = W / 2 + (i % 2 ? 1 : -1) * S * 0.15;
    a.y = H / 2 + S / 2 + (i < 2 ? -1 : 1) * S * 0.1;
    a.tx = clamp(W * out[i][0], minX(), maxX()); a.ty = clamp(H * out[i][1], minY(), maxY());
    a.retargetAt = performance.now() + 6000; a.phase = Math.random() * 10;
  });

  // ---- walking ----
  let last = performance.now();
  const frame = (now) => {
    const dt = clamp((now - last) / 1000, 0, 0.05); last = now;
    for (const a of agents) {
      let moving = false;
      if (a.napUntil <= now) {
        const dx = a.tx - a.x; const dy = a.ty - a.y; const d = Math.hypot(dx, dy);
        if (d < T * 0.8 || now > a.retargetAt) arrive(a, now);
        else {
          let ux = dx / d; let uy = dy / d;
          if (a.zigzag) { // Ankur weaves side to side
            const w = Math.sin(now / 260 + a.phase) * 0.7;
            [ux, uy] = [ux - uy * w, uy + ux * w];
            const n = Math.hypot(ux, uy); ux /= n; uy /= n;
          }
          const v = a.speed * px * (reduce ? 0.35 : 1) * dt;
          a.x = clamp(a.x + ux * v, minX(), maxX()); a.y = clamp(a.y + uy * v, minY(), maxY());
          if (Math.abs(ux) > 0.2) a.face = ux < 0 ? -1 : 1;
          moving = true;
        }
        claimBrush(own, count, cols, rows, Math.floor(a.x / T), Math.floor((a.y - T) / T), a.i, drawTile);
      }
      const bob = moving && !reduce ? -((Math.floor(now / a.step + a.phase) % 2) * a.bob * px) : 0;
      a.el.style.transform = `translate3d(${Math.round(a.x - S / 2)}px,${Math.round(a.y - S + bob)}px,0)`;
      a.el.style.zIndex = String(Math.round(a.y));
      a.rig.style.transform = a.face < 0 ? 'scaleX(-1)' : '';
      if (a.shown && now - a.tagAt > 300) { a.tagAt = now; updateTag(a); }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // ---- score ----
  bar.replaceChildren(...agents.map((a) => { const i = document.createElement('i'); i.style.background = a.color; return i; }));
  legend.replaceChildren(...agents.map((a) => {
    const d = document.createElement('div'); d.style.setProperty('--c', a.color);
    const b = document.createElement('b'); b.textContent = a.name;
    const s = document.createElement('span'); s.textContent = '0.0%';
    d.append(b, s); return d;
  }));
  const hud = () => agents.forEach((a, i) => {
    bar.children[i].style.width = `${pct(i)}%`;
    legend.children[i].lastChild.textContent = `${pct(i).toFixed(1)}%`;
  });
  hud();
  every(hud, 500);

  // Blinks: Pal often (eager), Ankur sometimes, Tara rarely (concentrating); Rupi only naps.
  if (!reduce) {
    for (const a of agents) {
      if (a.blink) every(() => { a.blinking = true; a.draw(); later(() => { a.blinking = false; a.draw(); }, 140); }, a.blink + Math.random() * 900);
      if (a.sweeps) every(() => { a.glint = true; a.draw(); later(() => { a.glint = false; a.draw(); }, 260); }, 3600);
    }
  }

  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(setup, 150); };
  window.addEventListener('resize', onResize);

  return function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    clearTimeout(rt);
    timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
    agents.forEach((a) => a.el.remove());
  };
}
