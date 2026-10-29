// client/src/pages/MomentPage.jsx
// Per-moment detail page. Route: /moments/:slug. Renders art + story from the
// static moments data. Unknown slug -> ErrorPage-style 404 via <Navigate>.
import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Seo from '../components/common/Seo';
import { MOMENTS, getMoment } from '../data/moments';

// Spain-flag palette for the Diwali celebration.
const SPAIN_COLORS = ['#C60B1E', '#FFC400', '#AA151B', '#F1BF00', '#FFFFFF'];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// Diwali-style fireworks overlay. Imperative: ref.burst(clientX, clientY) fires
// 4-5 rockets that rise and explode into a Spain-coloured shower of lights near
// the given point. Transparent full-screen canvas, additive blend for glow,
// short line-trails per particle so nothing darkens the page. rAF only runs
// while particles are alive.
const DiwaliFireworks = forwardRef(function DiwaliFireworks(_, ref) {
  const canvasRef = useRef(null);
  const partsRef = useRef([]);
  const rafRef = useRef(0);
  const dimRef = useRef(0); // dark-backdrop alpha, eases 0<->0.6
  const lastFlagRef = useRef(-1e9); // throttle flag bursts to 1 per 5s

  const resize = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!ctx) return; // jsdom / SSR: no 2d context
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    c.style.width = `${window.innerWidth}px`;
    c.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const explode = (x, y) => {
    const n = 90 + ((Math.random() * 70) | 0); // dense, fine burst
    const base = pick(SPAIN_COLORS);
    const spread = rand(3.5, 7);
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2);
      const sp = spread * Math.sqrt(Math.random()); // fill the disk, not just the rim
      partsRef.current.push({
        x, y, px: x, py: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        color: Math.random() < 0.7 ? base : pick(SPAIN_COLORS),
        life: 1, decay: rand(0.006, 0.008), size: rand(1, 2), // ~2.5s
        twinkle: Math.random() < 0.5, type: 'spark',
      });
    }
  };

  // Spain-flag burst: particles start at (cx,cy) and slowly ease to a grid that
  // paints the red-yellow-red flag, then linger before fading. Long life so the
  // flag holds on screen for everyone to see.
  const explodeFlag = (cx, cy) => {
    const W = 300, H = 200, cols = 36, rows = 24; // ~864 dots, 3:2 flag
    const x0 = cx - W / 2, y0 = cy - H / 2;
    for (let r = 0; r < rows; r++) {
      const frac = (r + 0.5) / rows;               // 0 top .. 1 bottom
      const red = frac < 0.25 || frac > 0.75;      // Spain: red-yellow-red (1:2:1)
      const color = red ? '#C60B1E' : '#FFC400';
      for (let c = 0; c < cols; c++) {
        const ang = rand(0, Math.PI * 2);
        const sp = rand(1, 4); // initial firework spray, then eases to flag
        partsRef.current.push({
          x: cx, y: cy, px: cx, py: cy,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          tx: x0 + ((c + 0.5) / cols) * W + rand(-3, 3),
          ty: y0 + frac * H + rand(-3, 3),
          color, life: 1, decay: 0.0033, size: rand(1, 2), // slow dissolve (~5s)
          twinkle: Math.random() < 0.35, type: 'flag',
        });
      }
    }
    // Heavy upward shower of red/yellow crackers under the flag — gives it weight.
    const heavy = 120 + ((Math.random() * 60) | 0);
    for (let i = 0; i < heavy; i++) {
      const ang = -Math.PI / 2 + rand(-0.6, 0.6); // upward cone
      const sp = rand(3, 9);
      partsRef.current.push({
        x: cx + rand(-W / 2, W / 2), y: cy + rand(0, H / 2), px: cx, py: cy,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        color: Math.random() < 0.5 ? '#C60B1E' : '#FFC400',
        life: 1, decay: rand(0.004, 0.006), size: rand(1, 2.4),
        twinkle: Math.random() < 0.3, type: 'spark',
      });
    }
  };

  const loop = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!ctx) { rafRef.current = 0; return; }
    const parts = partsRef.current;

    ctx.clearRect(0, 0, c.width, c.height);
    // Dark backdrop: eases in while fireworks burn, out when they die.
    const target = parts.length ? 0.6 : 0;
    dimRef.current += (target - dimRef.current) * 0.08;
    if (dimRef.current > 0.01) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = dimRef.current;
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.px = p.x; p.py = p.y;
      if (p.type === 'rocket' || p.type === 'rocketFlag') {
        p.x += p.vx; p.y += p.vy; p.fuse -= 1;
        ctx.globalAlpha = 1; ctx.strokeStyle = p.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
        if (p.y <= p.targetY || p.fuse <= 0) {
          (p.type === 'rocketFlag' ? explodeFlag : explode)(p.x, p.y);
          parts.splice(i, 1);
        }
        continue;
      }
      if (p.type === 'flag') {
        p.vx *= 0.9; p.vy *= 0.9;                    // spray decays...
        p.x += p.vx + (p.tx - p.x) * 0.06;           // ...as flag pull takes over
        p.y += p.vy + (p.ty - p.y) * 0.06;
        p.life -= p.decay;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        let a = Math.min(1, p.life * 1.3);
        if (p.twinkle) a *= 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 120 + p.x));
        ctx.globalAlpha = Math.max(0, a);
        // Dissolve: hold colour, then melt grey -> white as it dies.
        let col = p.color;
        if (p.life < 0.5) {
          const t = (0.5 - p.life) / 0.5;       // 0 -> 1 while dying
          const g = Math.round(130 + 125 * t);  // grey (130) -> white (255)
          col = `rgb(${g},${g},${g})`;
        }
        ctx.strokeStyle = col; ctx.lineWidth = p.size; // same streak as sparks
        ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
        continue;
      }
      p.vx *= 0.985; p.vy *= 0.985; p.vy += 0.03; // friction + gravity
      p.x += p.vx; p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      let a = p.life;
      if (p.twinkle) a *= 0.4 + 0.6 * Math.abs(Math.sin(Date.now() / 60 + p.x));
      ctx.globalAlpha = Math.max(0, a);
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (parts.length || dimRef.current > 0.01) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, c.width, c.height); // fully transparent again
      rafRef.current = 0;
    }
  }, []);

  const burst = useCallback((cx, cy) => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const sy = window.innerHeight + 20;
    const n = 4 + ((Math.random() * 2) | 0); // 4-5 crackers
    for (let i = 0; i < n; i++) {
      const tx = cx + rand(-130, 130);
      const ty = cy + rand(-90, 60);
      const startX = tx + rand(-30, 30);
      const dur = rand(34, 50); // slower rise
      partsRef.current.push({
        x: startX, y: sy, px: startX, py: sy,
        vx: (tx - startX) / dur, vy: (ty - sy) / dur,
        targetY: ty, fuse: Math.ceil(dur) + 4, color: pick(SPAIN_COLORS), type: 'rocket',
      });
    }
    // Flag cracker — throttled to once per 5s no matter how many clicks. Bursts
    // somewhere in the upper arc around the click (left/top/right, never below).
    const now = window.performance?.now?.() ?? Date.now();
    if (now - lastFlagRef.current >= 5000) {
      lastFlagRef.current = now;
      const a = rand(0, Math.PI);            // 0=right .. PI/2=top .. PI=left
      const R = rand(140, 220);
      const W2 = window.innerWidth;
      const fx = Math.min(Math.max(cx + Math.cos(a) * R, 170), W2 - 170);
      const fy = Math.max(cy - Math.sin(a) * R, 120); // sin>=0 → always upward
      const fdur = 68; // slower rise
      partsRef.current.push({
        x: fx, y: sy, px: fx, py: sy,
        vx: 0, vy: (fy - sy) / fdur,
        targetY: fy, fuse: fdur + 4, color: '#FFFFFF', type: 'rocketFlag',
      });
    }
    if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  useImperativeHandle(ref, () => ({ burst }), [burst]);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true" />;
});

function Block({ block }) {
  if (block.h2) {
    return <h2 className="mt-12 font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">{block.h2}</h2>;
  }
  // Quiet ending — one line to remember. Large, centered, hairline above.
  if (block.quote) {
    return (
      <p className="mx-auto mt-14 max-w-xl border-t-2 border-ink/10 pt-10 text-center font-heading text-xl font-semibold leading-snug tracking-tight text-ink sm:text-2xl">
        {block.quote}
      </p>
    );
  }
  return <p className="mt-6 text-base leading-relaxed text-muted sm:text-[17px]">{block.p}</p>;
}

export default function MomentPage() {
  const { slug } = useParams();
  const moment = getMoment(slug);
  const fwRef = useRef(null); // must run before any early return (rules of hooks)

  if (!moment) return <Navigate to="/404" replace />;

  const idx = MOMENTS.findIndex((m) => m.slug === slug);
  const prev = MOMENTS[idx + 1]; // older
  const next = MOMENTS[idx - 1]; // newer

  // Diwali celebration easter egg — Spain moment only.
  const isSpain = moment.slug === 'fifa-2026-winners-spain';
  const celebrate = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    fwRef.current?.burst(e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 3);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <Seo
        title={`${moment.title} — Moments · Meeticulous`}
        ogTitle={moment.title}
        description={moment.excerpt}
        image={moment.image}
        ogType="article"
        articlePublishedTime={new Date(moment.date).toISOString()}
        canonical={`https://meeticulous.com/moments/${moment.slug}`}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: moment.title,
          abstract: moment.excerpt,
          image: moment.image,
          url: `https://meeticulous.com/moments/${moment.slug}`,
          datePublished: moment.date,
          creator: { '@type': 'Organization', name: 'Meeticulous' },
        }}
      />

      <Link to="/moments" className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> All moments
      </Link>

      {isSpain && <DiwaliFireworks ref={fwRef} />}

      <img
        src={moment.image}
        alt={moment.alt}
        onClick={isSpain ? celebrate : undefined}
        title={isSpain ? 'Tap for Diwali fireworks 🎆' : undefined}
        className={`mx-auto mt-10 h-auto w-full max-w-2xl rounded-xl object-contain shadow-sm${isSpain ? ' cursor-pointer' : ''}`}
      />

      <p className="mt-10 text-sm font-medium text-primary">{moment.date}</p>
      <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">{moment.title}</h1>

      <div className="mt-2">
        {moment.body.map((block, i) => <Block key={i} block={block} />)}
      </div>

      {moment.credits && <p className="mt-12 text-xs italic text-muted">{moment.credits}</p>}

      {moment.cta && (
        <Link
          to={moment.cta.href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:gap-2.5"
        >
          {moment.cta.label} <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {(prev || next) && (
        <nav className="mt-12 flex items-center justify-between border-t-2 border-ink/10 pt-6 text-sm">
          {prev ? (
            <Link to={`/moments/${prev.slug}`} className="inline-flex items-center gap-1.5 text-muted transition hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> {prev.title}
            </Link>
          ) : <span />}
          {next ? (
            <Link to={`/moments/${next.slug}`} className="inline-flex items-center gap-1.5 text-right text-muted transition hover:text-primary">
              {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
