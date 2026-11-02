import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Video } from "lucide-react";
import Reveal from "./Reveal";
import { cleanSlug, saveHeroSlug } from "../../utils/heroSlug";

/* Homepage hero — owner reference (2026-11-02): full-screen crimson block, copy
   + "Claim my link" box on the left, a sample booking-page card on the right,
   and a thick pink ribbon that runs in from the left edge, loops into a cursive
   "ee" under the card and exits right. Sizing lives in `.home-hero` (index.css)
   so the ribbon, padding and full-screen height stay in one place.

   "Claim my link" stashes the typed slug and starts the existing Google sign-up;
   onboarding's SlugClaim step pre-fills it and does the real availability check
   (there is no public slug-check endpoint, so the hero doesn't claim to know). */

// The ee is drawn in a 560×220 box: band centred at y=130 (stroke 34) loops
// twice and the tail runs flat at y=150. The straight runs are part of the SAME
// stroke, extended far past the box (svg overflow: visible; the section clips
// them), so the band and the loop can never drift apart by a sub-pixel seam.
const EE_PATH =
  "M-4000,130 L0,130 C40,130 70,128 95,110 C125,88 135,50 105,40 C70,30 40,75 45,120 " +
  "C50,175 95,195 140,170 C170,150 200,110 225,95 C255,72 265,40 235,35 " +
  "C200,30 172,75 178,120 C185,170 230,195 280,175 C320,160 360,150 400,150 L4000,150";
const RIBBON = "var(--mt-pink)"; // the pink ee from the app icon
const BLUSH = "var(--mt-blush)"; // the blush app-icon background

// Sample services for the preview card (illustrative, INR).
const SAMPLE_SERVICES = [
  { name: "Discovery call", meta: "20 min · Free" },
  { name: "1:1 consultation", meta: "60 min · ₹1,500", popular: true },
  { name: "Group workshop", meta: "90 min · ₹499 per seat" },
];

function PreviewCard({ slug }) {
  const handle = slug || "yourname";
  return (
    <div className="w-full max-w-[360px] overflow-hidden rounded-[24px] bg-white text-ink">
      <div className="flex items-center gap-3 px-5 py-4" style={{ background: BLUSH }}>
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {handle.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-primary-cta">Your booking page</p>
          <p className="truncate text-xs text-neutral-600">meeticulous.com/{handle}</p>
        </div>
      </div>
      <ul className="space-y-2.5 bg-cream p-4">
        {SAMPLE_SERVICES.map((s) => (
          <li
            key={s.name}
            className={`flex items-center gap-3 rounded-[16px] px-4 py-3 ${
              s.popular ? "bg-primary text-white" : "border-2 border-neutral-100 bg-white"
            }`}
          >
            <Video size={18} className={s.popular ? "text-white" : "text-primary"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.name}</p>
              <p className={`text-xs ${s.popular ? "text-white/80" : "text-neutral-500"}`}>{s.meta}</p>
            </div>
            {s.popular ? (
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-primary-cta" style={{ background: RIBBON }}>
                Popular
              </span>
            ) : (
              <ChevronRight size={16} className="text-neutral-400" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomeHero({ onStart, loading }) {
  const [slug, setSlug] = useState("");

  const claim = (e) => {
    e.preventDefault();
    saveHeroSlug(slug);
    onStart();
  };

  return (
    <section className="home-hero relative overflow-hidden bg-primary px-5 pt-14 text-white sm:px-8 sm:pt-20">
      {/* Ribbon: one pink stroke in from the left edge, through the ee, out right. */}
      <svg
        aria-hidden
        viewBox="0 0 560 220"
        className="pointer-events-none absolute overflow-visible"
        style={{
          right: "var(--ee-r, 0px)",
          width: "calc(var(--ee-w, 200px) * 1.4)",
          bottom: "var(--ee-b, 0px)",
        }}
      >
        <path d={EE_PATH} fill="none" stroke={RIBBON} strokeWidth="34" strokeLinecap="butt" strokeLinejoin="round" />
      </svg>

      <div className="home-hero-grid relative z-10 mx-auto w-full max-w-6xl">
        <div>
          <Reveal instant as="h1" delay={0.05} className="home-hero-h1 font-display font-extrabold leading-[1.02] tracking-[-0.035em] text-white">
            Appointment booking software{" "}
            <span className="font-serif font-normal italic tracking-[-0.02em]" style={{ color: RIBBON }}>
              for creators, pros &amp; bros.
            </span>
          </Reveal>

          <Reveal instant as="p" delay={0.12} className="home-hero-sub mt-6 max-w-[34rem] leading-relaxed text-white/85">
            Get booked, paid and reminded — without the admin. One link turns your time, skills
            and services into paid bookings, with UPI checkout, WhatsApp reminders and GST invoices built in.
          </Reveal>

          {/* Claim my link → Google sign-up (same flow as /become-a-host) */}
          <Reveal instant delay={0.18} className="home-hero-cta mt-8">
            <form
              onSubmit={claim}
              className="flex w-full max-w-[34rem] flex-col gap-2 rounded-[16px] bg-white p-1.5 ring-2 ring-white/30 focus-within:ring-[3px] focus-within:ring-pink sm:flex-row sm:items-center"
            >
              <label htmlFor="hero-slug" className="flex min-w-0 flex-1 items-center px-3 py-2 text-sm sm:text-base">
                <span className="flex-shrink-0 text-neutral-500">meeticulous.com/</span>
                <input
                  id="hero-slug"
                  value={slug}
                  onChange={(e) => setSlug(cleanSlug(e.target.value))}
                  placeholder="yourname"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Your booking link"
                  className="min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 font-semibold text-primary caret-primary shadow-none outline-none focus:shadow-none focus-visible:outline-none placeholder:font-normal placeholder:text-neutral-400"
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="btn inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Opening Google…" : "Claim my link"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
            <p className="mt-3 flex max-w-[34rem] items-start gap-2 text-xs leading-relaxed text-white/75">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: RIBBON }} />
              <span>
                Next, sign in with Google — we&apos;ll check your link is free. By continuing, you agree to our{" "}
                <Link to="/terms" className="text-white/90 underline decoration-white/40 underline-offset-2 hover:text-white">Terms</Link> and{" "}
                <Link to="/privacy" className="text-white/90 underline decoration-white/40 underline-offset-2 hover:text-white">Privacy Policy</Link>.
              </span>
            </p>
          </Reveal>
        </div>

        {/* Sample booking page — desktop only (it would push the CTA down on phones) */}
        <Reveal instant delay={0.22} className="hidden justify-end lg:flex">
          <PreviewCard slug={slug} />
        </Reveal>
      </div>
    </section>
  );
}
