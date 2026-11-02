# About Page Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/about` into a long-scroll marketing page (typewriter hero, logo marquee, join split, sticky stacking cards, asymmetric case studies, flip testimonials, single-open FAQ, masonry team + modal) keeping the 6 non-duplicate existing sections appended.

**Architecture:** New section components in `client/src/components/about/`, all driven by existing GSAP + Lenis + ScrollTrigger (`gsapSetup.js`, `useAboutMotion.js`). New hero/testimonials/faq replace old `AboutHero`/`AboutTestimonials`/`AboutFaq`. Data lives in `aboutContent.js` with `data-swap` placeholders for assets pending. All motion honors `prefers-reduced-motion`; tests run under jsdom (motion no-ops).

**Tech Stack:** React 18 + Vite, Tailwind, GSAP (`@gsap/react` `useGSAP` + ScrollTrigger), lucide-react, react-router-dom v6, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-26-about-page-rebuild-design.md`

**Conventions (match existing About code):**
- Import GSAP only from `./gsapSetup` (`{ gsap, ScrollTrigger, useGSAP, EASE }`).
- Section reveals use `.js-head` / `.js-item` + `useGsapReveal(root)` where a generic grid reveal fits.
- Orange CTA = `bg-primary-cta ... hover:bg-primary-dark text-white` via `btn` class. Accent text = `text-primary`.
- Dark sections = `bg-ink text-white`; light = default canvas.
- Run tests from `client/`: `npm test -- <path>`.

---

### Task 1: Extend `aboutContent.js` with new section data

**Files:**
- Modify: `client/src/components/about/aboutContent.js`

- [ ] **Step 1: Append new data exports**

Add to the END of `client/src/components/about/aboutContent.js` (keep all existing exports unchanged):

```js
// ── New rebuild sections (2026-06-26). [TBD] assets marked data-swap. ──

// Section 2 — logo marquee. Placeholder names until real customer logos land.
export const logos = {
  eyebrow: "Trusted by calm professionals",
  row1: [
    { name: "Acme", swap: "logo-1" },
    { name: "Northwind", swap: "logo-2" },
    { name: "Globex", swap: "logo-3" },
    { name: "Umbra", swap: "logo-4" },
    { name: "Initech", swap: "logo-5" },
    { name: "Hooli", swap: "logo-6" },
  ],
  row2: [
    { name: "Soylent", swap: "logo-7" },
    { name: "Vehement", swap: "logo-8" },
    { name: "Massive", swap: "logo-9" },
    { name: "Pied Piper", swap: "logo-10" },
    { name: "Stark", swap: "logo-11" },
    { name: "Wayne", swap: "logo-12" },
  ],
};

// Section 3 — join / recruiting split (30/70). [COPY + IMAGE TBD]
export const join = {
  heading: "Join our team",
  body: "We're a small team building the calm way to get booked. Come build it with us.",
  cta: "Join the moment",
  href: "/careers",
  imageSwap: "join-hero",
};

// Section 4 — stacking cards. Big feature card + 4 sticky-stacking cards.
export const stackCards = {
  heading: "Everything you need. Nothing you don't.",
  feature: {
    title: "One calm link does the whole job.",
    body: "Publish your services, share one link, and let bookings, payments and reminders run themselves.",
    swap: "stack-feature",
  },
  cards: [
    { title: "Get booked", body: "Your page is live 24/7. Clients book while you sleep.", more: "Personal booking page, availability rules and two-way calendar sync — all in one place.", swap: "stack-1" },
    { title: "Get paid", body: "Money in before the session. No invoicing, no chasing.", more: "Razorpay UPI, cards and netbanking. Advance or full payment. Auto GST invoices.", swap: "stack-2" },
    { title: "Stay organized", body: "Every client, booking and rupee in one place.", more: "Client history, private notes, and bookings & revenue reports — zero spreadsheets.", swap: "stack-3" },
    { title: "Reduce no-shows", body: "Gentle reminders go out automatically.", more: "Email + WhatsApp reminders, instant confirmations and post-session follow-ups.", swap: "stack-4" },
  ],
};

// Section 5 — case studies asymmetric grid (top 70/30, bottom 30/30/30). [TBD]
export const caseStudies = {
  heading: "Stories from the calm.",
  tiles: [
    { title: "Coworking space cut no-shows", blurb: "Members book cabins themselves now.", swap: "case-1" },
    { title: "Clinic stopped chasing", blurb: "Patients pay upfront and turn up.", swap: "case-2" },
    { title: "Mentor on autopilot", blurb: "Weekend slots fill, money's in.", swap: "case-3" },
    { title: "GST season, sane", blurb: "Clients book instead of calling.", swap: "case-4" },
    { title: "One link in bio", blurb: "Looks better than a GPay QR.", swap: "case-5" },
  ],
};
```

- [ ] **Step 2: Extend each `team.members` entry with modal fields**

Replace the existing `team.members` array in `aboutContent.js` with:

```js
  members: [
    { name: "Founder Name", role: "Founder", quip: "Believes the best software disappears.", swap: "team-1", username: "founder", bio: "Building the calmest way for creators to get booked and paid. [Swap with real bio round-2.]", socials: [{ type: "x", href: "#" }, { type: "linkedin", href: "#" }] },
    { name: "Team Member", role: "Product & Design", quip: "Removes a tap a day.", swap: "team-2", username: "design", bio: "[Swap with real bio round-2.]", socials: [{ type: "x", href: "#" }, { type: "linkedin", href: "#" }] },
    { name: "Team Member", role: "Engineering", quip: "Ships on Fridays anyway.", swap: "team-3", username: "eng", bio: "[Swap with real bio round-2.]", socials: [{ type: "x", href: "#" }, { type: "linkedin", href: "#" }] },
  ],
```

- [ ] **Step 3: Verify it imports (build parse check)**

Run: `cd client && npx vite build --mode development 2>&1 | head -20`
Expected: build proceeds past module parse (no syntax error on `aboutContent.js`). It's fine if it completes or fails later for unrelated reasons — we only care no parse error here. (Faster alt: `node --check` won't work on ESM+JSX; rely on the next task's test import.)

- [ ] **Step 4: Commit**

```bash
git add client/src/components/about/aboutContent.js
git commit -m "feat(about): add data for rebuilt About sections"
```

---

### Task 2: `FaqAccordion` (replaces `AboutFaq`, single-open)

**Files:**
- Create: `client/src/components/about/FaqAccordion.jsx`
- Test: `client/src/components/about/__tests__/FaqAccordion.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/FaqAccordion.test.jsx`:

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FaqAccordion from "../FaqAccordion";

describe("FaqAccordion", () => {
  const expanded = (el) => el.getAttribute("aria-expanded");

  it("opens one panel on click and toggles closed", () => {
    render(<FaqAccordion />);
    const first = screen.getByRole("button", { name: /who are you/i });
    expect(expanded(first)).toBe("false");
    fireEvent.click(first);
    expect(expanded(first)).toBe("true");
    fireEvent.click(first);
    expect(expanded(first)).toBe("false");
  });

  it("single-open: opening a second closes the first", () => {
    render(<FaqAccordion />);
    const a = screen.getByRole("button", { name: /who are you/i });
    const b = screen.getByRole("button", { name: /where are you based/i });
    fireEvent.click(a);
    fireEvent.click(b);
    expect(expanded(a)).toBe("false");
    expect(expanded(b)).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/FaqAccordion.test.jsx`
Expected: FAIL — cannot resolve `../FaqAccordion`.

- [ ] **Step 3: Write the component**

Create `client/src/components/about/FaqAccordion.jsx` (logic identical to current `AboutFaq`, renamed):

```jsx
import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { gsap, useGSAP, EASE } from "./gsapSetup";
import { faq } from "./aboutContent";

export default function FaqAccordion() {
  const root = useRef(null);
  const [open, setOpen] = useState(-1);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".js-head", {
          opacity: 0,
          y: 28,
          duration: 0.8,
          ease: EASE,
          scrollTrigger: { trigger: root.current, start: "top 82%" },
        });
        gsap.from(".js-row", {
          opacity: 0,
          y: 24,
          duration: 0.6,
          ease: EASE,
          stagger: 0.08,
          scrollTrigger: { trigger: ".js-list", start: "top 80%" },
        });
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Questions</p>
        <h2 className="js-head mt-3 font-heading text-3xl font-bold sm:text-4xl">{faq.heading}</h2>
        <div className="js-list mt-8 divide-y divide-white/10 border-y border-white/10">
          {faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="js-row">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-heading text-lg font-semibold">{item.q}</span>
                  <Plus className={`h-5 w-5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`} />
                </button>
                <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr] pb-5 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <p className="overflow-hidden text-white/70">{item.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/FaqAccordion.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/about/FaqAccordion.jsx client/src/components/about/__tests__/FaqAccordion.test.jsx
git commit -m "feat(about): FaqAccordion (single-open) replacing AboutFaq"
```

---

### Task 3: `TestimonialsFlip` (replaces `AboutTestimonials`, hover-flip marquee)

**Files:**
- Create: `client/src/components/about/TestimonialsFlip.jsx`
- Test: `client/src/components/about/__tests__/TestimonialsFlip.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/TestimonialsFlip.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TestimonialsFlip from "../TestimonialsFlip";
import { testimonials } from "../aboutContent";

describe("TestimonialsFlip", () => {
  it("renders every host name and quote (front + back of each card)", () => {
    render(<TestimonialsFlip />);
    // Marquee duplicates the track, so each name appears at least once.
    expect(screen.getAllByText(testimonials.items[0].name).length).toBeGreaterThan(0);
    expect(screen.getAllByText(testimonials.items[0].quote).length).toBeGreaterThan(0);
  });

  it("renders the section heading", () => {
    render(<TestimonialsFlip />);
    expect(screen.getByRole("heading", { name: testimonials.heading })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/TestimonialsFlip.test.jsx`
Expected: FAIL — cannot resolve `../TestimonialsFlip`.

- [ ] **Step 3: Write the component**

Create `client/src/components/about/TestimonialsFlip.jsx`. Marquee = duplicated track translated R→L via GSAP (skipped under jsdom/reduced-motion); each card flips on hover/focus via CSS 3D.

```jsx
import { useRef, useState } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { testimonials } from "./aboutContent";

function Avatar({ src, name }) {
  const [err, setErr] = useState(false);
  if (err || !src) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
        {name?.charAt(0) || "★"}
      </div>
    );
  }
  return <img src={src} onError={() => setErr(true)} alt={name} loading="lazy" className="h-14 w-14 rounded-full object-cover" />;
}

function FlipCard({ t }) {
  return (
    <div className="group relative h-56 w-72 shrink-0 [perspective:1200px]">
      <div className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)] group-focus-within:[transform:rotateY(180deg)]">
        {/* Front */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[10px] border border-ink/10 bg-surface p-6 text-center [backface-visibility:hidden]">
          <Avatar src={t.avatar} name={t.name} />
          <div>
            <div className="font-heading font-semibold">{t.name}</div>
            <div className="text-sm text-ink/60">{t.role}</div>
          </div>
        </div>
        {/* Back */}
        <div className="absolute inset-0 flex flex-col justify-center rounded-[10px] bg-ink p-6 text-white [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <p className="text-sm leading-relaxed">“{t.quote}”</p>
          <div className="mt-3 text-xs font-semibold text-primary">{t.name} · {t.role}</div>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsFlip() {
  const root = useRef(null);
  const track = useRef(null);
  const items = testimonials.items;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Translate one full copy width, then loop seamlessly (track is duplicated).
        gsap.to(track.current, {
          xPercent: -50,
          duration: 40,
          ease: "none",
          repeat: -1,
        });
      });
    },
    { scope: root }
  );

  return (
    <section ref={root} className="overflow-hidden px-0 py-20 lg:py-28">
      <div className="mx-auto mb-10 max-w-6xl px-5 sm:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Loved by hosts</p>
        <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">{testimonials.heading}</h2>
      </div>
      <div ref={track} className="flex w-max gap-5 px-5">
        {[...items, ...items].map((t, i) => (
          <FlipCard key={i} t={t} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/TestimonialsFlip.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/about/TestimonialsFlip.jsx client/src/components/about/__tests__/TestimonialsFlip.test.jsx
git commit -m "feat(about): TestimonialsFlip hover-flip marquee replacing AboutTestimonials"
```

---

### Task 4: `HeroV2` (typewriter hero, replaces `AboutHero`)

**Files:**
- Create: `client/src/components/about/HeroV2.jsx`
- Test: `client/src/components/about/__tests__/HeroV2.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/HeroV2.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import HeroV2 from "../HeroV2";
import { hero } from "../aboutContent";

const setup = () => render(<HeroV2 />, { wrapper: MemoryRouter });

describe("HeroV2", () => {
  it("renders primary and ghost CTAs", () => {
    setup();
    expect(screen.getByRole("link", { name: hero.ctaPrimary })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hero.ctaGhost })).toBeInTheDocument();
  });

  it("exposes the full headline to assistive tech (sr-only typed word)", () => {
    setup();
    // The animated word is duplicated as sr-only text so SR reads the full phrase.
    expect(screen.getByTestId("hero-typeword")).toHaveTextContent(/.+/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/HeroV2.test.jsx`
Expected: FAIL — cannot resolve `../HeroV2`.

- [ ] **Step 3: Write the component**

Create `client/src/components/about/HeroV2.jsx`. Headline = `hero.h1` split so the LAST 2 words animate (type/erase/retype) in orange. A JS interval drives the typewriter; under reduced-motion it shows the static phrase. Full phrase always present as `sr-only` for accessibility (and the test).

```jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { hero, ROUTE_START } from "./aboutContent";

// The rotating words the hero types out. [COPY TBD — tune to taste.]
const WORDS = ["get booked.", "get paid.", "stay calm."];

function useTypewriter(words) {
  const [text, setText] = useState(words[0]);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let wi = 0, ci = words[0].length, deleting = false, raf;
    const tick = () => {
      const word = words[wi];
      ci += deleting ? -1 : 1;
      setText(word.slice(0, ci));
      let delay = deleting ? 45 : 90;
      if (!deleting && ci === word.length) { deleting = true; delay = 1400; }
      else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 250; }
      raf = window.setTimeout(tick, delay);
    };
    raf = window.setTimeout(tick, 1400);
    return () => window.clearTimeout(raf);
  }, [words]);
  return text;
}

export default function HeroV2() {
  const typed = useTypewriter(WORDS);
  const aura = useRef(null);

  // Static lead = headline minus its animated tail. Keep first sentence calm/black.
  const lead = "Your time is worth protecting.";

  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28">
      <div ref={aura} aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(55% 50% at 30% 30%, #FFE9DD 0%, transparent 70%)" }} />
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
        {/* LEFT */}
        <div>
          <h1 className="font-heading text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl">
            {lead}
            <br />
            <span className="text-primary">
              <span aria-hidden="true">{typed}</span>
              <span aria-hidden="true" className="ml-0.5 inline-block w-[2px] animate-pulse bg-primary align-middle" style={{ height: "0.9em" }} />
              <span data-testid="hero-typeword" className="sr-only">{WORDS.join(" ")}</span>
            </span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-ink/70">{hero.sub}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to={ROUTE_START} className="btn inline-flex items-center justify-center gap-1.5 bg-primary-cta px-7 py-3.5 text-white shadow-[var(--shadow-hard-1)] transition-colors hover:bg-primary-dark">
              {hero.ctaPrimary}
              <ArrowRight size={16} />
            </Link>
            <a href="#about-how" className="btn btn--outline inline-flex items-center justify-center px-7 py-3.5">
              {hero.ctaGhost}
            </a>
          </div>
        </div>
        {/* RIGHT — portrait [IMG TBD] */}
        <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[10px] bg-sand ring-1 ring-black/5" data-swap="hero-portrait">
          <div className="flex h-full w-full items-center justify-center text-ink/30">Portrait</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/HeroV2.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/about/HeroV2.jsx client/src/components/about/__tests__/HeroV2.test.jsx
git commit -m "feat(about): HeroV2 typewriter hero replacing AboutHero"
```

---

### Task 5: `LogoMarquee` (dual-row, grayscale→hover color)

**Files:**
- Create: `client/src/components/about/LogoMarquee.jsx`
- Test: `client/src/components/about/__tests__/LogoMarquee.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/LogoMarquee.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import LogoMarquee from "../LogoMarquee";
import { logos } from "../aboutContent";

describe("LogoMarquee", () => {
  it("renders both rows of logos (duplicated track)", () => {
    render(<LogoMarquee />);
    // Each row is duplicated for seamless loop → name appears >= 2 times.
    expect(screen.getAllByText(logos.row1[0].name).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(logos.row2[0].name).length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/LogoMarquee.test.jsx`
Expected: FAIL — cannot resolve `../LogoMarquee`.

- [ ] **Step 3: Write the component**

Create `client/src/components/about/LogoMarquee.jsx`. Two GSAP-driven rows (opposite directions); each logo grayscale by default, color on its own hover.

```jsx
import { useRef } from "react";
import { gsap, useGSAP } from "./gsapSetup";
import { logos } from "./aboutContent";

function LogoChip({ item }) {
  return (
    <span
      data-swap={item.swap}
      className="flex h-12 shrink-0 items-center justify-center rounded-[8px] border border-ink/10 bg-surface px-7 font-heading text-lg font-bold text-ink/40 grayscale transition-all duration-300 hover:text-primary hover:grayscale-0"
    >
      {item.name}
    </span>
  );
}

function Row({ items, dir }) {
  const track = useRef(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const from = dir === "rtl" ? 0 : -50;
        const to = dir === "rtl" ? -50 : 0;
        gsap.fromTo(track.current, { xPercent: from }, { xPercent: to, duration: 30, ease: "none", repeat: -1 });
      });
    },
    { scope: track }
  );
  return (
    <div className="flex w-max gap-5" ref={track}>
      {[...items, ...items].map((item, i) => (
        <LogoChip key={i} item={item} />
      ))}
    </div>
  );
}

export default function LogoMarquee() {
  return (
    <section className="overflow-hidden py-14">
      <p className="mb-8 px-5 text-center text-sm font-medium uppercase tracking-[0.2em] text-ink/40 sm:px-8">
        {logos.eyebrow}
      </p>
      <div className="space-y-4">
        <Row items={logos.row1} dir="ltr" />
        <Row items={logos.row2} dir="rtl" />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/LogoMarquee.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/about/LogoMarquee.jsx client/src/components/about/__tests__/LogoMarquee.test.jsx
git commit -m "feat(about): LogoMarquee dual-row grayscale-to-color"
```

---

### Task 6: `JoinSplit` (30/70 recruiting split)

**Files:**
- Create: `client/src/components/about/JoinSplit.jsx`
- Test: `client/src/components/about/__tests__/JoinSplit.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/JoinSplit.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import JoinSplit from "../JoinSplit";
import { join } from "../aboutContent";

describe("JoinSplit", () => {
  it("renders heading and CTA button", () => {
    render(<JoinSplit />, { wrapper: MemoryRouter });
    expect(screen.getByRole("heading", { name: join.heading })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: join.cta })).toHaveAttribute("href", join.href);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/JoinSplit.test.jsx`
Expected: FAIL — cannot resolve `../JoinSplit`.

- [ ] **Step 3: Write the component**

Create `client/src/components/about/JoinSplit.jsx`:

```jsx
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import useGsapReveal from "./useGsapReveal";
import { join } from "./aboutContent";

export default function JoinSplit() {
  const root = useRef(null);
  useGsapReveal(root);
  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-stretch gap-6 lg:grid-cols-[3fr_7fr]">
        {/* LEFT 30% */}
        <div className="js-item flex flex-col justify-center">
          <h2 className="js-head font-heading text-3xl font-bold sm:text-4xl">{join.heading}</h2>
          <p className="mt-4 text-ink/70">{join.body}</p>
          <Link to={join.href} className="btn mt-7 inline-flex w-fit items-center gap-1.5 bg-primary-cta px-7 py-3.5 text-white transition-colors hover:bg-primary-dark">
            {join.cta}
            <ArrowRight size={16} />
          </Link>
        </div>
        {/* RIGHT 70% — [IMG TBD] */}
        <div className="js-item relative aspect-[16/10] overflow-hidden rounded-[12px] bg-sand ring-1 ring-black/5" data-swap={join.imageSwap}>
          <div className="flex h-full w-full items-center justify-center text-ink/30">Team photo</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/JoinSplit.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/about/JoinSplit.jsx client/src/components/about/__tests__/JoinSplit.test.jsx
git commit -m "feat(about): JoinSplit 30/70 recruiting section"
```

---

### Task 7: `StackingCards` (big card + 4 sticky-stacking cards)

**Files:**
- Create: `client/src/components/about/StackingCards.jsx`
- Test: `client/src/components/about/__tests__/StackingCards.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/StackingCards.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import StackingCards from "../StackingCards";
import { stackCards } from "../aboutContent";

describe("StackingCards", () => {
  it("renders the big feature card and all 4 stacking cards", () => {
    render(<StackingCards />, { wrapper: MemoryRouter });
    expect(screen.getByRole("heading", { name: stackCards.feature.title })).toBeInTheDocument();
    stackCards.cards.forEach((c) => {
      expect(screen.getByRole("heading", { name: c.title })).toBeInTheDocument();
    });
  });

  it("each stacking card exposes primary + ghost hover buttons", () => {
    render(<StackingCards />, { wrapper: MemoryRouter });
    // 4 cards × 2 buttons = 8 links to the funnel/learn-more.
    expect(screen.getAllByRole("link", { name: /get started/i }).length).toBe(stackCards.cards.length);
    expect(screen.getAllByRole("link", { name: /learn more/i }).length).toBe(stackCards.cards.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/StackingCards.test.jsx`
Expected: FAIL — cannot resolve `../StackingCards`.

- [ ] **Step 3: Write the component**

Create `client/src/components/about/StackingCards.jsx`. Sticky stack via CSS `position: sticky` (robust, no JS measuring); hover panel via CSS translate. `id="about-how"` anchors the hero ghost CTA.

```jsx
import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { gsap, useGSAP, EASE } from "./gsapSetup";
import { stackCards, ROUTE_START } from "./aboutContent";

const ACCENTS = ["var(--c-blue)", "var(--c-emerald)", "var(--c-violet)", "var(--c-amber)"];

export default function StackingCards() {
  const root = useRef(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from(".js-head", {
          opacity: 0, y: 28, duration: 0.8, ease: EASE,
          scrollTrigger: { trigger: root.current, start: "top 82%" },
        });
      });
    },
    { scope: root }
  );

  return (
    <section id="about-how" ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">How it works</p>
        <h2 className="js-head mt-3 font-heading text-3xl font-bold sm:text-4xl">{stackCards.heading}</h2>

        {/* Big horizontal feature card */}
        <div className="mt-10 overflow-hidden rounded-[16px] bg-ink p-8 text-white sm:p-12" data-swap={stackCards.feature.swap}>
          <h3 className="font-heading text-2xl font-bold sm:text-3xl">{stackCards.feature.title}</h3>
          <p className="mt-3 max-w-xl text-white/70">{stackCards.feature.body}</p>
        </div>

        {/* 4 sticky-stacking cards */}
        <div className="mt-10">
          {stackCards.cards.map((c, i) => (
            <div key={i} className="sticky" style={{ top: `${6 + i * 1.5}rem` }}>
              <div
                className="group relative mb-6 h-[320px] overflow-hidden rounded-[16px] border border-ink/10 bg-surface p-8 shadow-[0_20px_45px_-25px_rgba(26,26,26,0.4)]"
                style={{ borderTopColor: ACCENTS[i], borderTopWidth: 3 }}
              >
                <div className="flex h-32 items-center justify-center rounded-[10px] bg-sand text-ink/30" data-swap={c.swap}>Image</div>
                <h3 className="mt-5 font-heading text-xl font-bold">{c.title}</h3>
                <p className="mt-2 text-ink/70">{c.body}</p>

                {/* Hover panel — slides over bottom half */}
                <div className="absolute inset-x-0 bottom-0 translate-y-full rounded-t-[16px] bg-ink p-8 text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-within:translate-y-0">
                  <p className="text-sm text-white/80">{c.more}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to={ROUTE_START} className="btn inline-flex items-center gap-1.5 bg-primary-cta px-5 py-2.5 text-sm text-white transition-colors hover:bg-primary-dark">
                      Get started <ArrowRight size={14} />
                    </Link>
                    <Link to={ROUTE_START} className="btn btn--outline inline-flex items-center px-5 py-2.5 text-sm text-white">
                      Learn more
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/StackingCards.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add client/src/components/about/StackingCards.jsx client/src/components/about/__tests__/StackingCards.test.jsx
git commit -m "feat(about): StackingCards sticky-stack with hover panel"
```

---

### Task 8: `CaseStudyGrid` (asymmetric 70/30 + 30/30/30)

**Files:**
- Create: `client/src/components/about/CaseStudyGrid.jsx`
- Test: `client/src/components/about/__tests__/CaseStudyGrid.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/CaseStudyGrid.test.jsx`:

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CaseStudyGrid from "../CaseStudyGrid";
import { caseStudies } from "../aboutContent";

describe("CaseStudyGrid", () => {
  it("renders all 5 case-study tiles", () => {
    render(<CaseStudyGrid />);
    caseStudies.tiles.forEach((t) => {
      expect(screen.getByRole("heading", { name: t.title })).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/CaseStudyGrid.test.jsx`
Expected: FAIL — cannot resolve `../CaseStudyGrid`.

- [ ] **Step 3: Write the component**

Create `client/src/components/about/CaseStudyGrid.jsx`. Top row 70/30, bottom row thirds.

```jsx
import { useRef } from "react";
import useGsapReveal from "./useGsapReveal";
import { caseStudies } from "./aboutContent";

function Tile({ t, className }) {
  return (
    <article className={`js-item group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-[14px] bg-ink p-6 text-white ${className}`} data-swap={t.swap}>
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-70 transition-opacity group-hover:opacity-90" />
      <div className="relative">
        <h3 className="font-heading text-xl font-bold">{t.title}</h3>
        <p className="mt-1 text-sm text-white/70">{t.blurb}</p>
      </div>
    </article>
  );
}

export default function CaseStudyGrid() {
  const root = useRef(null);
  useGsapReveal(root);
  const [a, b, c, d, e] = caseStudies.tiles;
  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Case studies</p>
        <h2 className="js-head mt-3 font-heading text-3xl font-bold sm:text-4xl">{caseStudies.heading}</h2>

        {/* Top row 70 / 30 */}
        <div className="mt-10 grid gap-5 lg:grid-cols-[7fr_3fr]">
          <Tile t={a} />
          <Tile t={b} />
        </div>
        {/* Bottom row 30 / 30 / 30 */}
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Tile t={c} />
          <Tile t={d} />
          <Tile t={e} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/CaseStudyGrid.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/about/CaseStudyGrid.jsx client/src/components/about/__tests__/CaseStudyGrid.test.jsx
git commit -m "feat(about): CaseStudyGrid asymmetric tile layout"
```

---

### Task 9: `TeamMasonry` + `TeamModal` (masonry grid, click → modal)

**Files:**
- Create: `client/src/components/about/TeamModal.jsx`
- Create: `client/src/components/about/TeamMasonry.jsx`
- Test: `client/src/components/about/__tests__/TeamMasonry.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `client/src/components/about/__tests__/TeamMasonry.test.jsx`:

```jsx
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import TeamMasonry from "../TeamMasonry";
import { team } from "../aboutContent";

const setup = () => render(<TeamMasonry />, { wrapper: MemoryRouter });

describe("TeamMasonry", () => {
  it("opens a modal with both buttons linking to the member page", () => {
    setup();
    const m = team.members[0];
    fireEvent.click(screen.getByRole("button", { name: new RegExp(m.name, "i") }));
    const dialog = screen.getByRole("dialog");
    const book = within(dialog).getByRole("link", { name: /book a session/i });
    const visit = within(dialog).getByRole("link", { name: /visit their page/i });
    expect(book).toHaveAttribute("href", `/${m.username}`);
    expect(visit).toHaveAttribute("href", `/${m.username}`);
  });

  it("closes the modal on Escape", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(team.members[0].name, "i") }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- src/components/about/__tests__/TeamMasonry.test.jsx`
Expected: FAIL — cannot resolve `../TeamMasonry`.

- [ ] **Step 3: Write `TeamModal.jsx`**

Create `client/src/components/about/TeamModal.jsx`. Esc + backdrop close; focus-managed dialog; two buttons → `/${username}`.

```jsx
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { X, ArrowRight, ExternalLink } from "lucide-react";

export default function TeamModal({ member, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!member) return null;
  const page = `/${member.username}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={member.name} className="relative grid w-full max-w-2xl gap-6 overflow-hidden rounded-[16px] bg-surface p-6 shadow-2xl sm:grid-cols-[2fr_3fr] sm:p-8">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-ink/50 hover:text-ink">
          <X className="h-5 w-5" />
        </button>
        {/* LEFT image [TBD] */}
        <div className="aspect-square overflow-hidden rounded-[12px] bg-sand ring-1 ring-black/5" data-swap={member.swap}>
          <div className="flex h-full w-full items-center justify-center text-ink/30">Photo</div>
        </div>
        {/* RIGHT bio + socials + buttons */}
        <div className="flex flex-col">
          <h3 className="font-heading text-2xl font-bold">{member.name}</h3>
          <p className="text-primary">{member.role}</p>
          <p className="mt-3 text-sm text-ink/70">{member.bio}</p>
          <div className="mt-4 flex gap-3">
            {member.socials.map((s, i) => (
              <a key={i} href={s.href} className="text-sm font-medium uppercase tracking-wide text-ink/50 hover:text-primary">{s.type}</a>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap gap-3 pt-6">
            <Link to={page} className="btn inline-flex items-center gap-1.5 bg-primary-cta px-5 py-2.5 text-sm text-white transition-colors hover:bg-primary-dark">
              Book a session <ArrowRight size={14} />
            </Link>
            <Link to={page} className="btn btn--outline inline-flex items-center gap-1.5 px-5 py-2.5 text-sm">
              Visit their page <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `TeamMasonry.jsx`**

Create `client/src/components/about/TeamMasonry.jsx`. CSS columns = masonry; staggered `mt` per index for irregular placement; each person is a `<button>` opening the modal.

```jsx
import { useRef, useState } from "react";
import useGsapReveal from "./useGsapReveal";
import { team } from "./aboutContent";
import TeamModal from "./TeamModal";

// Irregular vertical offsets so the masonry reads "placed", not gridded.
const OFFSETS = ["mt-0", "mt-10", "mt-4", "mt-14", "mt-6", "mt-2"];

export default function TeamMasonry() {
  const root = useRef(null);
  useGsapReveal(root, ".js-item");
  const [active, setActive] = useState(null);

  return (
    <section ref={root} className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">{team.sub}</p>
        <h2 className="js-head mt-3 font-heading text-3xl font-bold sm:text-4xl">{team.heading}</h2>

        <div className="mt-10 columns-2 gap-5 sm:columns-3">
          {team.members.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(m)}
              className={`js-item group mb-5 block w-full break-inside-avoid overflow-hidden rounded-[12px] border border-ink/10 bg-surface text-left ${OFFSETS[i % OFFSETS.length]}`}
            >
              <div className="aspect-[4/5] bg-sand" data-swap={m.swap}>
                <div className="flex h-full w-full items-center justify-center text-ink/30">Photo</div>
              </div>
              <div className="p-4">
                <div className="font-heading font-semibold">{m.name}</div>
                <div className="text-sm text-ink/60">{m.role}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      {active && <TeamModal member={active} onClose={() => setActive(null)} />}
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd client && npm test -- src/components/about/__tests__/TeamMasonry.test.jsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/about/TeamMasonry.jsx client/src/components/about/TeamModal.jsx client/src/components/about/__tests__/TeamMasonry.test.jsx
git commit -m "feat(about): TeamMasonry grid + TeamModal with booking links"
```

---

### Task 10: Wire `About.jsx` to new order; delete superseded components

**Files:**
- Modify: `client/src/pages/About.jsx`
- Modify: `client/src/pages/__tests__/About.test.jsx`
- Delete: `client/src/components/about/AboutHero.jsx`
- Delete: `client/src/components/about/AboutTestimonials.jsx`
- Delete: `client/src/components/about/AboutFaq.jsx`
- Delete: `client/src/components/about/__tests__/AboutFaq.test.jsx`

- [ ] **Step 1: Read the current About test to match its assertions**

Run: `cat client/src/pages/__tests__/About.test.jsx`
Note what it currently asserts (likely renders without crash + some section text). You will update it in Step 4.

- [ ] **Step 2: Rewrite `About.jsx`**

Replace `client/src/pages/About.jsx` with:

```jsx
import Seo from "../components/common/Seo";
import useAboutMotion from "../components/about/useAboutMotion";
import HeroV2 from "../components/about/HeroV2";
import LogoMarquee from "../components/about/LogoMarquee";
import JoinSplit from "../components/about/JoinSplit";
import StackingCards from "../components/about/StackingCards";
import CaseStudyGrid from "../components/about/CaseStudyGrid";
import TestimonialsFlip from "../components/about/TestimonialsFlip";
import FaqAccordion from "../components/about/FaqAccordion";
import TeamMasonry from "../components/about/TeamMasonry";
// Appended (kept) original sections:
import ProblemSplit from "../components/about/ProblemSplit";
import BeliefGrid from "../components/about/BeliefGrid";
import BehindProduct from "../components/about/BehindProduct";
import StatStrip from "../components/about/StatStrip";
import BuildFlow from "../components/about/BuildFlow";
import TrustGrid from "../components/about/TrustGrid";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Meeticulous",
  url: "https://meeticulous.com",
  description:
    "Meeticulous helps creators publish services, get booked, and get paid — with 0% commission.",
};

export default function About() {
  useAboutMotion();
  return (
    <main className="bg-[var(--bg)]">
      <Seo
        title="About Meeticulous — the calm way to get booked"
        description="Why we exist, who we are, and how we help creators get booked and paid without commission."
        jsonLd={JSON_LD}
      />
      {/* New design block */}
      <HeroV2 />
      <LogoMarquee />
      <JoinSplit />
      <StackingCards />
      <CaseStudyGrid />
      <TestimonialsFlip />
      <FaqAccordion />
      <TeamMasonry />
      {/* Appended original sections */}
      <ProblemSplit />
      <BeliefGrid />
      <BehindProduct />
      <StatStrip />
      <BuildFlow />
      <TrustGrid />
    </main>
  );
}
```

- [ ] **Step 3: Delete superseded files**

```bash
git rm client/src/components/about/AboutHero.jsx \
       client/src/components/about/AboutTestimonials.jsx \
       client/src/components/about/AboutFaq.jsx \
       client/src/components/about/__tests__/AboutFaq.test.jsx
```

- [ ] **Step 4: Update `About.test.jsx`**

Open `client/src/pages/__tests__/About.test.jsx`. Ensure it renders inside a router and asserts a stable new-section signal. Replace its body with:

```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import About from "../About";

describe("About page", () => {
  it("renders the rebuilt About page with hero CTAs and FAQ", () => {
    render(<About />, { wrapper: MemoryRouter });
    // New hero ghost CTA + a kept section heading both present.
    expect(screen.getAllByRole("link", { name: /let's get started/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /questions, answered/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the full About-related suite**

Run: `cd client && npm test -- src/components/about src/pages/__tests__/About.test.jsx`
Expected: PASS — all about component tests + About page test green; no references to deleted `AboutFaq`/`AboutHero`/`AboutTestimonials`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/About.jsx client/src/pages/__tests__/About.test.jsx
git commit -m "feat(about): wire rebuilt About page; remove superseded sections"
```

---

### Task 11: Full verification (suite + build + preview)

**Files:** none (verification only)

- [ ] **Step 1: Run the full client test suite**

Run: `cd client && npm test`
Expected: PASS. If any pre-existing unrelated failures appear (e.g. `routeManifestSync`, `Payouts`), confirm they fail identically on `main` before continuing — do not fix unrelated tests here.

- [ ] **Step 2: Production build**

Run: `cd client && npm run build`
Expected: build succeeds, no unresolved imports from deleted components.

- [ ] **Step 3: Preview-verify the page**

Start the dev server (preview_start) and load `/about`. Confirm visually:
- Hero typewriter types/erases/retypes the accent words; both CTAs render.
- Logo marquee scrolls in two opposite directions; hovering one logo colors only it.
- Join split shows 30/70 layout.
- Stacking cards stack on scroll; hover slides the panel with 2 buttons.
- Case-study grid is 70/30 then 30/30/30.
- Testimonials flip on hover revealing the quote.
- FAQ opens single-open.
- Clicking a team member opens the modal; Esc/backdrop closes it; both buttons point to `/<username>`.
- Check desktop + mobile (preview_resize) and console for errors (preview_console_logs).

- [ ] **Step 4: Final commit (if any preview fixes were needed)**

```bash
git add -A
git commit -m "fix(about): preview-verified polish for rebuilt About page"
```

---

## Self-Review notes

- **Spec coverage:** Hero/typewriter (T4), logo marquee grayscale→hover (T5), join 30/70 (T6), stacking cards 4-set + hover panel (T7), case studies 70/30+thirds (T8), flip testimonials (T3), single-open FAQ (T2), team masonry+modal w/ "Book a session"+"Visit their page" → `/:username` (T9), dedup + append 6 old sections (T10), data placeholders w/ `data-swap` (T1). All spec sections mapped.
- **Type/name consistency:** data keys (`logos.row1/row2`, `join.heading/cta/href/imageSwap`, `stackCards.feature/cards`, `caseStudies.tiles`, `team.members[].username/bio/socials`) are defined in Task 1 and consumed verbatim in Tasks 5–9.
- **Note:** `team` already exports `heading`/`sub` (existing) — TeamMasonry reuses them; no new top-level team heading needed.
- **Route assumption:** member page = `/${username}` (booking page profile route). If the profile route differs, adjust the `page` const in `TeamModal.jsx` and the T9 test together.
