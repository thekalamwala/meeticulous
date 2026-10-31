import { useRef } from "react";
import { beliefs } from "./aboutContent";
import useGsapReveal from "./useGsapReveal";

// "What we believe." — centred full-width heading (like the other About sections), three columns split by dashed dividers,
// each with a line-art illustration, title and one line. Illustrations are
// original ink line art with brand-crimson fills (matches the white + crimson
// About page). No transition on .js-item opacity/transform (GSAP owns those).

const INK = "#2A1416";
const RED = "#960D32";
const LINE = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" };

// Time should never be wasted — an hourglass beside a clock with a crimson
// "minutes given back" wedge.
const TimeArt = () => (
  <svg viewBox="0 0 240 200" aria-hidden="true" className="h-full w-full">
    {/* clock */}
    <circle cx="148" cy="96" r="62" fill="#fff" {...LINE} />
    <path d="M148 96V46A50 50 0 0 1 193 74z" fill={RED} />
    <circle cx="148" cy="96" r="50" {...LINE} strokeWidth="1.6" strokeDasharray="2 7" />
    <path d="M148 58v38l26 16" {...LINE} strokeWidth="3" />
    <circle cx="148" cy="96" r="4.5" fill={INK} />
    {[0, 90, 180, 270].map((a) => (
      <path key={a} d="M148 40v8" {...LINE} transform={`rotate(${a} 148 96)`} />
    ))}
    {/* hourglass */}
    <path d="M44 52h50M44 172h50" {...LINE} strokeWidth="3.2" />
    <path d="M50 52c0 28 18 36 18 60s-18 32-18 60M88 52c0 28-18 36-18 60s18 32 18 60" fill="#fff" {...LINE} />
    <path d="M57 70h24c-3 12-12 18-12 18s-9-6-12-18z" fill={RED} />
    <path d="M55 166c3-14 10-20 14-22 4 2 11 8 14 22z" fill={RED} />
    <path d="M69 92v40" stroke={RED} strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
    {/* motion ticks */}
    <path d="M214 60l10-6M220 96h12M214 132l10 6" {...LINE} />
  </svg>
);

// Your clients are yours — your own booking page (your avatar, crimson Book
// button) with a client linked straight to it.
const ClientsArt = () => (
  <svg viewBox="0 0 240 200" aria-hidden="true" className="h-full w-full">
    {/* booking page */}
    <rect x="86" y="22" width="112" height="160" rx="12" fill="#fff" {...LINE} />
    <path d="M128 32h28" {...LINE} />
    <circle cx="142" cy="66" r="18" fill="#fff" {...LINE} />
    <path d="M142 58a6 6 0 1 1 0 12 6 6 0 0 1 0-12zM131 80c2-6 6-8 11-8s9 2 11 8" {...LINE} strokeWidth="2" />
    <path d="M114 98h56" {...LINE} strokeWidth="3" />
    <path d="M120 108h44" {...LINE} strokeWidth="1.8" opacity=".5" />
    {[0, 1, 2].map((i) => (
      <rect key={i} x={104 + i * 28} y="120" width="20" height="14" rx="3" fill={i === 1 ? RED : "#fff"} stroke={i === 1 ? RED : INK} strokeWidth="1.8" />
    ))}
    <rect x="104" y="146" width="76" height="20" rx="5" fill={RED} />
    <path d="M128 156h28" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    {/* the client */}
    <circle cx="42" cy="118" r="24" fill="#fff" {...LINE} />
    <path d="M42 106a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM28 136c3-8 8-11 14-11s11 3 14 11" {...LINE} strokeWidth="2" />
    {/* direct line + heart */}
    <path d="M66 118c10 0 14-10 22-12" {...LINE} strokeDasharray="3 5" />
    <path d="M70 76c-6-6-16 0-10 8l10 9 10-9c6-8-4-14-10-8z" fill={RED} stroke={RED} strokeWidth="1.5" strokeLinejoin="round" />
    {/* sparkle */}
    <path d="M214 46v12M208 52h12M210 160l8-6" {...LINE} />
  </svg>
);

// Pricing should be honest — a crimson price tag with a clear tick, beside a
// short, readable receipt.
const PricingArt = () => (
  <svg viewBox="0 0 240 200" aria-hidden="true" className="h-full w-full">
    {/* receipt */}
    <path d="M118 26h88v150l-11-7-11 7-11-7-11 7-11-7-11 7-11-7-11 7z" fill="#fff" {...LINE} />
    <path d="M134 50h56M134 66h40M134 82h48" {...LINE} strokeWidth="2" opacity=".55" />
    <path d="M134 108h56" {...LINE} strokeWidth="1.6" strokeDasharray="3 4" />
    <path d="M134 126h22M176 126h14" {...LINE} strokeWidth="3" />
    {/* price tag */}
    <g transform="rotate(-14 76 110)">
      <path d="M30 86h70l26 24-26 24H30a8 8 0 0 1-8-8V94a8 8 0 0 1 8-8z" fill={RED} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="104" cy="110" r="5" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M44 110l10 10 20-20" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
    {/* string */}
    <path d="M120 84c6-10 2-22-8-26" {...LINE} strokeWidth="1.8" />
    {/* sparkles */}
    <path d="M30 44v12M24 50h12M218 186l8-6" {...LINE} />
  </svg>
);

const ART = { time: TimeArt, clients: ClientsArt, pricing: PricingArt };

export default function BeliefGrid() {
  const root = useRef(null);
  useGsapReveal(root);

  return (
    <section ref={root} className="px-5 py-16 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <h2 className="js-head text-center font-heading text-4xl font-extrabold sm:text-5xl">{beliefs.heading}</h2>
        <p className="mt-5 text-center text-lg leading-relaxed text-ink/70">{beliefs.sub}</p>

        <div className="mt-12 grid gap-y-12 md:mt-16 md:grid-cols-3">
          {beliefs.items.map((b) => {
            const Art = ART[b.art];
            return (
              <div
                key={b.title}
                className="js-item flex flex-col items-center px-4 text-center md:border-l md:border-dashed md:border-black/15 md:px-8"
              >
                <div className="h-44 w-full max-w-[240px] sm:h-48">{Art && <Art />}</div>
                <h3 className="mt-6 font-heading text-2xl font-bold text-ink">{b.title}</h3>
                <p className="mt-3 max-w-xs text-base leading-relaxed text-ink/70">{b.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
