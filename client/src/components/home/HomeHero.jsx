import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { cleanSlug, saveHeroSlug } from "../../utils/heroSlug";

/* Homepage hero — owner reference (2026-11-02): full-screen crimson block, copy
   + "Claim my link" box on the left, the silhouette art on the right, and the
   thick pink ribbon that runs in from the left edge, loops into a cursive "ee"
   and exits right across both. Sizing lives in `.home-hero` (index.css) so the
   art, ribbon, padding and full-screen height stay in one place.

   "Claim my link" stashes the typed slug and sends the visitor to the /become-a-host
   signup page (which carries the slug through and lets them pick Google / LinkedIn /
   email), rather than firing the Google OAuth popup straight from the hero.
   Onboarding's SlugClaim step pre-fills the slug and does the real availability check
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
export default function HomeHero() {
  const [slug, setSlug] = useState("");
  const navigate = useNavigate();

  const claim = (e) => {
    e.preventDefault();
    saveHeroSlug(slug);
    // Send them to the signup page (which pre-fills the slug) instead of
    // firing the Google OAuth popup directly from the hero.
    navigate("/become-a-host", { state: { desiredUsername: slug } });
  };

  return (
    <section className="home-hero relative overflow-hidden bg-primary px-5 pt-14 text-white sm:px-8 sm:pt-20">
      {/* Silhouette: small desktop-only art just above the pink "ee".
          Lives behind the copy and the ribbon (see .home-hero-figure). */}
      <div aria-hidden className="home-hero-figure">
        <img src="/home/Four Plush Mascots on Pink Platform.png" alt="" decoding="async" />
      </div>

      {/* Ribbon: one pink stroke in from the left edge, through the ee, out right. */}
      <svg
        aria-hidden
        viewBox="0 0 560 220"
        className="pointer-events-none absolute z-[1] overflow-visible"
        style={{
          right: "var(--ee-r, 0px)",
          width: "calc(var(--ee-w, 200px) * 1.4)",
          bottom: "var(--ee-b, 0px)",
        }}
      >
        <path d={EE_PATH} fill="none" stroke={RIBBON} strokeWidth="34" strokeLinecap="butt" strokeLinejoin="round" />
      </svg>

      {/* Very light rose loop pattern (official DS file), densest at the top-right
          corner and fading out toward the bottom-middle — tone-on-tone, behind
          content, masked so it never sits under the left-column copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: "url(/brand/ds/03-patterns/mt-pattern-loop-rose.svg)",
          backgroundRepeat: "repeat",
          backgroundSize: "150px",
          opacity: 0.08,
          WebkitMaskImage: "radial-gradient(130% 115% at 100% 0%, #000 0%, transparent 58%)",
          maskImage: "radial-gradient(130% 115% at 100% 0%, #000 0%, transparent 58%)",
        }}
      />

      {/* Brand camera+calendar illustration (official DS file, untouched) in the
          top-right of the hero. */}
      <img
        src="/brand/ds/04-illustrations/mt-camcal-white.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-5 top-20 z-[1] hidden w-24 opacity-90 sm:right-8 sm:top-24 sm:block lg:right-12 lg:top-28 lg:w-32"
      />

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
                <span className="flex-shrink-0 text-neutral-600">meeticulous.com/</span>
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
                className="btn inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Claim my link
                <ArrowRight size={16} />
              </button>
            </form>
            <p className="mt-3 flex max-w-[34rem] items-start gap-2 text-xs leading-relaxed text-white/75">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: RIBBON }} />
              <span>
                By continuing, you agree to our{" "}
                <Link to="/terms" className="text-white/90 underline decoration-white/40 underline-offset-2 hover:text-white">Terms</Link> and{" "}
                <Link to="/privacy" className="text-white/90 underline decoration-white/40 underline-offset-2 hover:text-white">Privacy Policy</Link>.
              </span>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
