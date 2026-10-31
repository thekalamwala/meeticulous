// client/src/components/admin/seo/SeoNetwork.jsx
// Interactive internal-link network for the latest crawl, styled after a site-audit
// backlink graph: airy, near-monochrome, with the homepage as the focal root. Dots =
// crawled pages (size = inbound links = "how well linked-to"), lines = internal links.
// Hover a dot to fade the graph and trace a dashed path from the homepage to it; click
// to open the same SeoInspector the list rows use (node id === crawl_page id). Drag to
// rearrange, scroll to zoom, drag empty space to pan. Self-contained canvas force sim —
// no dependency, smooth at one crawl's few-hundred-node scale.
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Ic from '../Ic';
import { IC } from '../adminNav';
import { Card, Skeleton, Btn } from '../ui';
import { adminSeoLinkGraph } from '../../../services/api';
import SeoInspector from './SeoInspector';

// Muted categorical hues — distinct but restrained so the graph stays airy on both themes.
const TYPE_COLOR = { static: '#8fa0b8', blog: '#2fb39b', service: '#5b8def', host: '#FF9FB0', unknown: '#b6bfca', other: '#b6bfca' };
const TYPE_LABEL = { static: 'Static & landing', blog: 'Blog post', service: 'Service page', host: 'Host profile', unknown: 'Other', other: 'Other' };
const TYPE_ORDER = ['static', 'blog', 'service', 'host', 'other'];
// Page-type priority for the anchored layout — which pages earn the 8 outer slots.
const TYPE_PRIORITY = { static: 1, blog: 2, service: 3, host: 4, unknown: 5, other: 5 };
const ORPHAN = '#e0a458', ERRC = '#e5534b';
const typeColor = (t) => TYPE_COLOR[t] || TYPE_COLOR.other;
const typeLabel = (t) => TYPE_LABEL[t] || 'Other';

// Physics (spring-electrical); forces scale by a cooling alpha so the graph settles.
const REP = 780, SPRING = 0.02, LEN = 58, GRAV = 0.028, DECAY = 0.86;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nodeRadius = (n) => clamp(3 + 2.1 * Math.sqrt(n.inbound || 0), 3.5, 26);
const isOrphan = (n) => !n.__root && n.links_crawled && (n.inbound || 0) === 0;
const hasProblem = (n) => (n.http_status && n.http_status !== 200) || n.indexable === false;

export default function SeoNetwork() {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [selectedId, setSelectedId] = useState(null);
  const [hover, setHover] = useState(null);
  const [catFilter, setCatFilter] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [layout, setLayout] = useState('tidy'); // 'tidy' | 'force' | 'anchored'

  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const probeRef = useRef(null);
  const simRef = useRef(null);
  const viewRef = useRef({ ox: 0, oy: 0, z: 1, W: 0, H: 0, dpr: 1 });
  const themeRef = useRef({ ink: [31, 39, 51], muted: [150, 162, 180], accent: [254, 81, 0] });
  const dragRef = useRef(null);
  const dirtyRef = useRef(true);
  const rafRef = useRef(0);
  const drawRef = useRef(() => {});
  const flagsRef = useRef({ catFilter: '', showLabels: false, focusId: null, layout: 'tidy' });
  const layoutRef = useRef('tidy');
  const frozenRef = useRef(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await adminSeoLinkGraph();
      setState({ loading: false, error: null, data });
    } catch (e) {
      setState({ loading: false, error: e.response?.data?.message || 'Failed to load link network', data: null });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const presentTypes = useMemo(() => {
    const set = new Set((state.data?.nodes || []).map((n) => (TYPE_COLOR[n.page_type] ? n.page_type : 'other')));
    return TYPE_ORDER.filter((t) => set.has(t));
  }, [state.data]);

  // ── Build the simulation + adjacency + BFS parents from the homepage root ─────
  const rebuild = useCallback(() => {
    const data = state.data; const cv = canvasRef.current;
    if (!data || !cv) return;
    const { W, H } = viewRef.current;
    const cx = (W || cv.clientWidth || 900) / 2, cy = (H || cv.clientHeight || 560) / 2;
    const spread = Math.min(W || 900, H || 560) / 3 || 220;

    const byId = new Map();
    const nodes = (data.nodes || []).map((n) => {
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * spread;
      const node = { ...n, x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, vx: 0, vy: 0 };
      byId.set(n.id, node); return node;
    });
    // Focal root = the homepage (path '/'); fall back to the most linked-to page.
    let root = nodes.find((n) => n.path === '/') || null;
    if (!root && nodes.length) root = nodes.reduce((a, b) => (b.inbound > (a ? a.inbound : -1) ? b : a), null);
    if (root) { root.__root = true; root.x = cx; root.y = cy; root.r = 0; }
    nodes.forEach((n) => { n.r = n.__root ? Math.max(9, nodeRadius(n)) : nodeRadius(n); });

    const edges = [];
    const adj = new Map(nodes.map((n) => [n.id, []]));
    for (const e of data.edges || []) {
      const s = byId.get(e.source), t = byId.get(e.target);
      if (s && t) { edges.push({ s, t }); adj.get(e.source).push(e.target); adj.get(e.target).push(e.source); }
    }
    const parent = new Map();
    if (root) { parent.set(root.id, null); const q = [root.id]; while (q.length) { const u = q.shift(); for (const v of adj.get(u) || []) if (!parent.has(v)) { parent.set(v, u); q.push(v); } } }
    // A link whose target is linked by a big share of the site (homepage, nav/footer
    // targets) is chrome, not relatedness — flag it so Tidy can de-weight it.
    const ubiq = Math.max(24, nodes.length * 0.22);
    edges.forEach((e) => { e.weak = (e.t.inbound || 0) > ubiq; });

    let rootLabel = 'Homepage';
    try { if (root) rootLabel = new URL(root.url).host; } catch { /* keep default */ }

    simRef.current = { nodes, edges, byId, parent, rootId: root ? root.id : null, rootLabel, alpha: 1 };
    if (layoutRef.current === 'anchored') applyAnchored(simRef.current);
    else if (layoutRef.current === 'tidy') parkUnlinked(simRef.current);
    dirtyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data]);

  const pathToRoot = (id) => {
    const s = simRef.current; if (!s || !s.parent.has(id)) return null;
    const out = []; let cur = id, guard = 0;
    while (cur != null && guard++ < 9999) { out.push(cur); cur = s.parent.get(cur); }
    return out;
  };

  // Mirror draw-only state into a ref so the loop always reads fresh values.
  useEffect(() => {
    flagsRef.current = { catFilter, showLabels, focusId: hover?.id || selectedId, layout };
    dirtyRef.current = true;
  }, [catFilter, showLabels, hover, selectedId, layout]);

  // Switch layout: pin/release anchored hubs or the parked ring, reset the view, and
  // reheat so the graph re-settles into the chosen shape.
  useEffect(() => {
    layoutRef.current = layout;
    frozenRef.current = false;
    const s = simRef.current;
    if (s) {
      clearAnchors(s); releaseParked(s);
      if (layout === 'anchored') applyAnchored(s);
      else if (layout === 'tidy') parkUnlinked(s);
      viewRef.current = { ...viewRef.current, ox: 0, oy: 0, z: 1 };
      s.alpha = 1;
    }
    dirtyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // ── Theme colours (resolve token classes to rgb so canvas strokes can carry alpha) ─
  const readTheme = useCallback(() => {
    const probe = probeRef.current; if (!probe) return;
    const parse = (fb) => { const m = getComputedStyle(probe).color.match(/\d+/g); return (m && m.length >= 3) ? [+m[0], +m[1], +m[2]] : fb; };
    probe.style.color = ''; probe.className = 'adm-t1'; const ink = parse([31, 39, 51]);
    probe.className = 'adm-t3'; const muted = parse([150, 162, 180]);
    probe.className = ''; probe.style.color = 'var(--adm-accent)'; const accent = parse([254, 81, 0]);
    probe.style.color = '';
    themeRef.current = { ink, muted, accent };
    dirtyRef.current = true;
  }, []);

  const resize = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap) return;
    const dpr = window.devicePixelRatio || 1, W = wrap.clientWidth, H = wrap.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    viewRef.current = { ...viewRef.current, W, H, dpr };
    const s = simRef.current;
    if (s && layoutRef.current === 'anchored') placeAnchors(s);
    else if (s && layoutRef.current === 'tidy') { releaseParked(s); parkUnlinked(s); }
    dirtyRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = useCallback(() => {
    const s = simRef.current; if (!s) return;
    const { nodes, edges } = s; const { W, H } = viewRef.current;
    const cx = W / 2, cy = H / 2, drag = dragRef.current?.node || null;
    const lay = layoutRef.current, tidy = lay === 'tidy';
    // Tidy: forces scale to the canvas (fill the space), collision stops overlap, and
    // ubiquitous nav/footer links are de-weighted so real clusters separate.
    // Anchored: homepage + the 8 hubs are fixed; softer gravity clusters spokes on their hub.
    let REPc = REP, LENc = LEN;
    if (tidy) { const k = Math.sqrt((W * H) / Math.max(1, nodes.length)); LENc = clamp(k * 0.8, 28, 120); REPc = clamp(k * k * 0.5, 300, 3200); }
    const grav = lay === 'anchored' ? GRAV * 0.4 : (tidy ? GRAV * 0.55 : GRAV);
    const pinned = (n) => n === drag || n.fixed;
    s.alpha *= 0.986; if (s.alpha < 0.02) s.alpha = 0; const a = s.alpha; if (a === 0) return;
    for (const n of nodes) { if (pinned(n)) continue; n.vx += (cx - n.x) * grav * a; n.vy += (cy - n.y) * grav * a; }
    for (let i = 0; i < nodes.length; i++) { const ni = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) { const nj = nodes[j];
        let dx = ni.x - nj.x, dy = ni.y - nj.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = Math.random() * 2 - 1; dy = Math.random() * 2 - 1; }
        const d = Math.sqrt(d2), f = (REPc * a) / d, fx = dx / d * f, fy = dy / d * f;
        ni.vx += fx; ni.vy += fy; nj.vx -= fx; nj.vy -= fy;
        // Collision: never let two dots overlap.
        if (tidy) { const md = ni.r + nj.r + 3; if (d < md) { const p = (md - d) * 0.5, ux = dx / d, uy = dy / d; ni.vx += ux * p; ni.vy += uy * p; nj.vx -= ux * p; nj.vy -= uy * p; } }
      }
    }
    for (const e of edges) {
      if (tidy && e.weak) continue; // de-weight ubiquitous hub links
      const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - LENc) * SPRING * a, fx = dx / d * f, fy = dy / d * f;
      if (!pinned(e.s)) { e.s.vx += fx; e.s.vy += fy; } if (!pinned(e.t)) { e.t.vx -= fx; e.t.vy -= fy; }
    }
    for (const n of nodes) { if (pinned(n)) { n.vx = n.vy = 0; continue; } n.vx *= DECAY; n.vy *= DECAY; n.x += n.vx; n.y += n.vy; }
  }, []);

  const draw = useCallback(() => {
    const cv = canvasRef.current, s = simRef.current; if (!cv || !s) return;
    const ctx = cv.getContext('2d');
    const { W, H, dpr, ox, oy, z } = viewRef.current;
    const { catFilter: cat, showLabels: labels, focusId, layout: lay } = flagsRef.current;
    const th = themeRef.current;
    const rgba = (c, al) => `rgba(${c[0]},${c[1]},${c[2]},${al})`;
    const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
    const dim = (t) => cat && (TYPE_COLOR[t] ? t : 'other') !== cat;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.translate(ox, oy); ctx.scale(z, z);

    const focus = focusId ? s.byId.get(focusId) : null;
    const path = focus ? pathToRoot(focus.id) : null;
    const pathSet = path ? new Set(path) : null;

    // Edges
    ctx.lineWidth = 0.9 / z;
    const tidyE = lay === 'tidy';
    for (const e of s.edges) {
      let faded = focus ? 0.05 : (cat ? (dim(e.s.page_type) && dim(e.t.page_type) ? 0.05 : 0.16) : 0.16);
      if (tidyE && e.weak && !focus) faded = 0.03; // hush the hub spokes so real clusters read
      ctx.strokeStyle = rgba(th.muted, faded);
      ctx.beginPath(); ctx.moveTo(e.s.x, e.s.y); ctx.lineTo(e.t.x, e.t.y); ctx.stroke();
    }
    // Dashed trace: homepage → hovered/selected node
    if (path && path.length > 1) {
      ctx.save(); ctx.setLineDash([5 / z, 4 / z]); ctx.lineWidth = 1.6 / z; ctx.strokeStyle = rgb(th.accent);
      ctx.beginPath();
      path.forEach((id, i) => { const n = s.byId.get(id); if (i === 0) ctx.moveTo(n.x, n.y); else ctx.lineTo(n.x, n.y); });
      ctx.stroke(); ctx.restore();
    }

    // Nodes
    for (const n of s.nodes) {
      let alphaN = 1;
      if (focus) alphaN = (pathSet && pathSet.has(n.id)) || n === focus ? 1 : 0.12;
      else if (cat) alphaN = dim(n.page_type) ? 0.14 : 1;
      ctx.globalAlpha = alphaN;
      const r = n.r * (n === focus ? 1.25 : 1);
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.__root ? rgb(th.accent) : typeColor(n.page_type);
      ctx.fill();
      if (hasProblem(n)) { ctx.lineWidth = 2 / z; ctx.strokeStyle = ERRC; ctx.stroke(); }
      else if (isOrphan(n)) { ctx.lineWidth = 2 / z; ctx.strokeStyle = ORPHAN; ctx.stroke(); }
      if (n === focus) { ctx.lineWidth = 2.5 / z; ctx.strokeStyle = rgb(th.accent); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }

    // Labels: root always; hubs when toggled; hovered node
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const drawLabel = (n, color, weight) => {
      const raw = n.__root ? s.rootLabel : (n.title || n.path || '');
      const t = raw.length > 30 ? `${raw.slice(0, 29)}…` : raw;
      ctx.font = `${weight} ${11.5 / z}px 'Poppins', system-ui, sans-serif`;
      ctx.fillStyle = color; ctx.fillText(t, n.x, n.y - n.r - 3 / z);
    };
    if (!focus && lay === 'anchored') { for (const n of s.nodes) if (n.__anchor) drawLabel(n, rgb(th.ink), 700); }
    else if (!focus && labels) { ctx.globalAlpha = 0.9; for (const n of s.nodes) if (!n.__root && n.r >= 9) drawLabel(n, rgb(th.ink), 600); ctx.globalAlpha = 1; }
    if (s.rootId) drawLabel(s.byId.get(s.rootId), rgb(th.accent), 800);
    if (focus && !focus.__root) drawLabel(focus, rgb(th.ink), 700);
  }, []);
  useEffect(() => { drawRef.current = draw; });

  // ── Boot: build sim, size, warm up, fit, then run the loop ────────────────────
  const ready = !state.loading && !state.error && !!state.data?.nodes?.length;
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return undefined;
    resize(); readTheme(); rebuild();
    // Pre-warm so the first frame is already settled (no start-up explosion).
    const s = simRef.current;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (s) { const warm = reduce ? 500 : 200; for (let i = 0; i < warm; i++) { s.alpha = Math.max(s.alpha, 0.3); step(); } if (reduce) s.alpha = 0; }
    fitView();
    const ro = new ResizeObserver(() => resize());
    ro.observe(wrapRef.current);
    const mo = new MutationObserver(() => readTheme());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    if (document.fonts?.ready) document.fonts.ready.then(() => { dirtyRef.current = true; });
    const frame = () => {
      const sim = simRef.current;
      if (sim && sim.alpha > 0) { step(); dirtyRef.current = true; }
      if (dirtyRef.current) { drawRef.current(); dirtyRef.current = false; }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); mo.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, resize, readTheme, rebuild, step]);

  // ── Interaction ───────────────────────────────────────────────────────────────
  const toWorld = (cx, cy) => {
    const rect = canvasRef.current.getBoundingClientRect(), v = viewRef.current;
    const sx = cx - rect.left, sy = cy - rect.top;
    return { sx, sy, x: (sx - v.ox) / v.z, y: (sy - v.oy) / v.z };
  };
  const nodeAt = (x, y) => {
    const s = simRef.current; if (!s) return null;
    for (let i = s.nodes.length - 1; i >= 0; i--) { const n = s.nodes[i], dx = n.x - x, dy = n.y - y, r = n.r + 4; if (dx * dx + dy * dy <= r * r) return n; }
    return null;
  };
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toWorld(e.clientX, e.clientY), n = nodeAt(p.x, p.y);
    dragRef.current = n ? { node: n, moved: false, dsx: p.sx, dsy: p.sy }
      : { pan: true, moved: false, dsx: p.sx, dsy: p.sy, ox: viewRef.current.ox, oy: viewRef.current.oy };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current, p = toWorld(e.clientX, e.clientY);
    if (d) {
      if (Math.abs(p.sx - d.dsx) + Math.abs(p.sy - d.dsy) > 4) d.moved = true;
      if (d.node) { d.node.x = p.x; d.node.y = p.y; d.node.vx = d.node.vy = 0; if (!frozenRef.current && simRef.current) simRef.current.alpha = Math.max(simRef.current.alpha, 0.35); }
      else { viewRef.current.ox = d.ox + (p.sx - d.dsx); viewRef.current.oy = d.oy + (p.sy - d.dsy); }
      dirtyRef.current = true; return;
    }
    const n = nodeAt(p.x, p.y);
    if (n) setHover({ id: n.id, title: n.__root ? (simRef.current?.rootLabel || 'Homepage') : n.title, path: n.path, page_type: n.page_type, inbound: n.inbound, outbound: n.outbound, links_crawled: n.links_crawled, http_status: n.http_status, indexable: n.indexable, root: n.__root, sx: p.sx, sy: p.sy });
    else if (hover) setHover(null);
    if (canvasRef.current) canvasRef.current.style.cursor = n ? 'pointer' : 'grab';
  };
  const onPointerUp = (e) => {
    const d = dragRef.current; dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (d?.node && !d.moved) setSelectedId(d.node.id);
  };
  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect(), sx = e.clientX - rect.left, sy = e.clientY - rect.top, v = viewRef.current;
      const z = clamp(v.z * Math.exp(-e.deltaY * 0.0015), 0.15, 4);
      v.ox = sx - (sx - v.ox) / v.z * z; v.oy = sy - (sy - v.oy) / v.z * z; v.z = z; dirtyRef.current = true;
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, [ready]);

  function fitView() {
    const s = simRef.current, v = viewRef.current; if (!s || !s.nodes.length) return;
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (const n of s.nodes) { a = Math.min(a, n.x - n.r); b = Math.min(b, n.y - n.r); c = Math.max(c, n.x + n.r); d = Math.max(d, n.y + n.r); }
    const gw = c - a || 1, gh = d - b || 1, pad = 56;
    v.z = clamp(Math.min((v.W - pad) / gw, (v.H - pad) / gh), 0.15, 3);
    v.ox = v.W / 2 - (a + c) / 2 * v.z; v.oy = v.H / 2 - (b + d) / 2 * v.z; dirtyRef.current = true;
  }
  // Re-layout: unfreeze, re-pin the anchored/tidy structure, and re-settle.
  const reheat = () => {
    const s = simRef.current; if (!s) return;
    frozenRef.current = false;
    if (layoutRef.current === 'anchored') { clearAnchors(s); applyAnchored(s); }
    else if (layoutRef.current === 'tidy') { releaseParked(s); parkUnlinked(s); }
    s.alpha = 1; dirtyRef.current = true;
  };
  // Expand: blow the whole structure outward from its centre so no dots overlap, and
  // freeze it there (drag/scroll to explore, Fit to reframe, Re-layout to snap back).
  // Repeatable — each click spreads ~1.8× farther.
  const expand = () => {
    const s = simRef.current; if (!s || !s.nodes.length) return;
    let cx = 0, cy = 0; for (const n of s.nodes) { cx += n.x; cy += n.y; } cx /= s.nodes.length; cy /= s.nodes.length;
    const F = 1.8;
    for (const n of s.nodes) { n.x = cx + (n.x - cx) * F; n.y = cy + (n.y - cy) * F; n.vx = n.vy = 0; }
    frozenRef.current = true; s.alpha = 0; dirtyRef.current = true;
  };

  // ── Anchored layout: homepage centred, top hubs pinned around the edge ────────
  // 8 evenly-spaced points on an inset ellipse = the 4 side-midpoints + 4 corners.
  function anchorPoints() {
    const { W, H } = viewRef.current;
    const cx = W / 2, cy = H / 2;
    const rx = Math.max(120, W * 0.40), ry = Math.max(110, H * 0.40);
    const pts = [];
    for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * (Math.PI / 4); pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); }
    return { cx, cy, pts };
  }
  // Re-seat the fixed nodes (homepage + mapped hubs) at the current anchor points.
  function placeAnchors(s) {
    const { cx, cy, pts } = anchorPoints();
    if (s.rootId) { const r = s.byId.get(s.rootId); r.fixed = true; r.x = cx; r.y = cy; r.r = Math.max(12, nodeRadius(r)); }
    (s.anchorMap || []).forEach((id, i) => { if (!id) return; const n = s.byId.get(id); if (!n) return; n.fixed = true; n.__anchor = true; n.x = pts[i].x; n.y = pts[i].y; n.r = Math.max(12, nodeRadius(n)); });
  }
  // Choose the 8 outer hubs by page-type priority (tie-break: most inbound), then
  // assign each to its nearest free anchor so edges stay short.
  function applyAnchored(s) {
    clearAnchors(s);
    const { pts } = anchorPoints();
    const hubs = s.nodes
      .filter((n) => !n.__root)
      .sort((x, y) => (TYPE_PRIORITY[x.page_type] || 5) - (TYPE_PRIORITY[y.page_type] || 5) || (y.inbound - x.inbound))
      .slice(0, pts.length);
    const used = new Array(pts.length).fill(false);
    const map = new Array(pts.length).fill(null);
    for (const hub of hubs) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < pts.length; i++) { if (used[i]) continue; const dx = pts[i].x - hub.x, dy = pts[i].y - hub.y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
      if (best >= 0) { used[best] = true; map[best] = hub.id; }
    }
    s.anchorMap = map;
    placeAnchors(s);
  }
  function clearAnchors(s) {
    s.anchorMap = null;
    s.nodes.forEach((n) => { n.fixed = false; n.__anchor = false; n.r = n.__root ? Math.max(9, nodeRadius(n)) : nodeRadius(n); });
  }

  // ── Tidy layout: park the unlinked pages (orphans + meta-only) in a ring around
  //    the edge so they stop scattering into the whitespace and the core stays clean.
  function parkUnlinked(s) {
    const deg = new Map(s.nodes.map((n) => [n.id, 0]));
    s.edges.forEach((e) => { deg.set(e.s.id, deg.get(e.s.id) + 1); deg.set(e.t.id, deg.get(e.t.id) + 1); });
    const unlinked = s.nodes.filter((n) => !n.__root && deg.get(n.id) === 0);
    const { W, H } = viewRef.current;
    const cx = W / 2, cy = H / 2, rx = W * 0.46, ry = H * 0.44;
    const perRing = Math.max(30, Math.floor((rx * 2) / 15));
    unlinked.forEach((n, i) => {
      const ring = Math.floor(i / perRing), inRing = i % perRing;
      const count = Math.min(perRing, unlinked.length - ring * perRing);
      const ang = (inRing / count) * Math.PI * 2 - Math.PI / 2;
      n.fixed = true; n.__parked = true;
      n.x = cx + Math.cos(ang) * (rx + ring * 26);
      n.y = cy + Math.sin(ang) * (ry + ring * 20);
    });
  }
  function releaseParked(s) { s.nodes.forEach((n) => { if (n.__parked) { n.fixed = false; n.__parked = false; } }); }

  // ── Derived stats ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const nodes = state.data?.nodes || [];
    return {
      pages: nodes.length,
      links: state.data?.edges?.length || 0,
      orphans: nodes.filter((n) => n.path !== '/' && n.links_crawled && (n.inbound || 0) === 0).length,
      notCrawled: nodes.filter((n) => !n.links_crawled).length,
    };
  }, [state.data]);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (state.loading) return <Skeleton className="h-[70vh]" />;
  if (state.error) {
    return (
      <Card className="text-sm">
        <p className="adm-t2 mb-3">{state.error}</p>
        <Btn size="sm" variant="outline" icon="refresh" onClick={load}>Retry</Btn>
      </Card>
    );
  }
  if (!state.data?.nodes?.length) {
    return (
      <Card className="text-center py-10">
        <p className="adm-t1 font-semibold mb-1">No link network yet</p>
        <p className="adm-t3 text-sm">Run <b>Run crawl + sync</b> above — the network is built from the latest crawl&apos;s pages and their internal links.</p>
      </Card>
    );
  }

  return (
    <div>
      <span ref={probeRef} aria-hidden style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select className="fb-input text-sm" value={layout} onChange={(e) => setLayout(e.target.value)} aria-label="Graph layout">
          <option value="tidy">Layout: Tidy</option>
          <option value="force">Layout: Free</option>
          <option value="anchored">Layout: Anchored</option>
        </select>
        <select className="fb-input text-sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} aria-label="Filter by page type">
          <option value="">All page types</option>
          {presentTypes.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
        </select>
        <Btn size="sm" variant={showLabels ? 'primary' : 'outline'} onClick={() => setShowLabels((v) => !v)}>Hub labels</Btn>
        <div className="flex gap-1.5 ml-auto">
          <Btn size="sm" variant="outline" onClick={fitView}>Fit</Btn>
          <Btn size="sm" variant="outline" onClick={expand}>Expand ↔</Btn>
          <Btn size="sm" variant="outline" icon="refresh" onClick={reheat}>Re-layout</Btn>
        </div>
      </div>

      {/* Canvas */}
      <Card className="p-0 overflow-hidden">
        <div ref={wrapRef} className="relative w-full" style={{ height: '68vh', minHeight: 460 }}>
          <canvas
            ref={canvasRef}
            className="block w-full h-full touch-none select-none"
            style={{ cursor: 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => { if (!dragRef.current) setHover(null); }}
          />

          {/* Stat strip */}
          <div className="absolute top-3 right-3 flex gap-4 text-[11.5px] adm-t3">
            <span><b className="adm-t1 tabular-nums">{stats.pages}</b> pages</span>
            <span><b className="adm-t1 tabular-nums">{stats.links}</b> links</span>
            <span><b style={{ color: stats.orphans ? 'var(--adm-warn)' : undefined }} className="tabular-nums">{stats.orphans}</b> orphans</span>
          </div>

          {/* Hover tooltip card */}
          {hover && hover.sx != null && (() => {
            const problem = hover.http_status && hover.http_status !== 200 ? `HTTP ${hover.http_status}` : hover.indexable === false ? 'noindex' : null;
            const orphan = !hover.root && hover.links_crawled && (hover.inbound || 0) === 0;
            return (
              <div className="absolute z-10 pointer-events-none rounded-xl adm-card border adm-border shadow-xl p-3"
                style={{ left: clamp(hover.sx + 14, 8, (viewRef.current.W || 400) - 244), top: clamp(hover.sy + 14, 8, (viewRef.current.H || 400) - 96), width: 236 }}>
                <div className="flex items-start gap-2">
                  <span className="w-2.5 h-2.5 rounded-full mt-1 flex-none" style={{ background: hover.root ? 'var(--adm-accent)' : typeColor(hover.page_type) }} />
                  <span className="font-bold adm-t1 text-[13.5px] leading-tight break-words">{hover.title || hover.path}</span>
                  <span className="ml-auto text-right flex-none">
                    <b className="adm-t1 text-[15px] tabular-nums">{hover.inbound}</b>
                    <span className="block text-[9px] uppercase tracking-wide adm-t3">inbound</span>
                  </span>
                </div>
                <div className="text-[11.5px] adm-t2 mt-0.5">{typeLabel(hover.page_type)}{problem ? ` · ${problem}` : orphan ? ' · orphan' : ''}</div>
                {!hover.links_crawled && <div className="text-[11px] adm-t3 mt-0.5">outbound links not crawled</div>}
                <div className="text-[11.5px] mt-2 pt-1.5" style={{ borderTop: '1px dashed var(--adm-border)', color: 'var(--adm-accent)' }}>Click to view page details →</div>
              </div>
            );
          })()}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 rounded-xl adm-card border adm-border px-3 py-2 text-[10.5px] adm-t3 leading-relaxed max-w-[46%]">
            <div className="font-bold adm-t1 text-[11px] mb-1">Dot size = inbound links</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {presentTypes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: typeColor(t) }} />{typeLabel(t).replace(' & landing', '')}</span>
              ))}
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: ORPHAN }} />orphan</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: ERRC }} />noindex / error</span>
            </div>
            {stats.notCrawled > 0 && <div className="adm-t3 mt-1.5 opacity-90">{stats.notCrawled} host/service pages are meta-only — their outbound links aren&apos;t mapped yet.</div>}
          </div>
        </div>
      </Card>

      {selectedId && <SeoInspector pageId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
