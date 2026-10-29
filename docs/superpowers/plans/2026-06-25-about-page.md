# About Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `client/src/pages/About.jsx` with a 12-section, story-driven About page that reuses the homepage design system, all content placeholder-grade and swappable round-2.

**Architecture:** Approach B — `About.jsx` composes 12 focused components under `client/src/components/about/`. Reuse `components/home/Reveal.jsx`, `.btn`, section shell, `--c-*` palette, lucide icons, `sloth-float`/`sloth-draw` keyframes as-is. Lift-and-localize the Odometer counter and FAQ accordion patterns from `Home.jsx` (do NOT refactor Home). All copy/data centralized in `aboutContent.js`; placeholders carry `data-swap` markers.

**Tech Stack:** React 18 + Vite, Tailwind, Framer Motion v12.40, lucide-react, Vitest + @testing-library/react. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-25-about-page-design.md`

**Design tokens reference (do not reinvent):**
- Section shell: `<section className="px-5 py-20 sm:px-8 lg:py-28"><div className="mx-auto max-w-6xl">…</div></section>`
- Dark section: add `bg-ink text-white`.
- Headings: `font-heading` (Plus Jakarta Sans), `font-bold`. Body: default Poppins.
- Primary CTA: `className="btn inline-flex items-center justify-center bg-primary-cta text-white hover:-translate-y-0.5"`. Ghost: `className="btn btn--outline"`.
- Accent palette cycle: `["var(--c-blue)","var(--c-violet)","var(--c-cyan)","var(--c-emerald)","var(--c-amber)","var(--c-pink)"]`.
- Reveal usage: `import Reveal from "../home/Reveal";` then `<Reveal as="h2" delay={0.05} className="…">…</Reveal>`.
- Reduced motion: Reveal already handles it; gate any custom animation behind `useReducedMotion()` from framer-motion.

**CTA targets (match homepage):** Inspect `Home.jsx` hero/pricing CTAs for the exact "Let's Get Started" destination (host get-started route) and reuse the same `to`/handler. "Become a host" → same become-host CTA the homepage/footer uses.

---

## Task 0: Branch + worktree sanity

- [ ] **Step 1:** Confirm on `feat/about-page` and tree clean except plans/specs.

Run: `git branch --show-current && git status --porcelain`
Expected: `feat/about-page`; only untracked docs if any.

> NOTE (landmine — see memory `shared-worktree-head-drift`): a concurrent session can switch this working tree's HEAD mid-task. After each commit, run `git branch --show-current` to confirm still on `feat/about-page`. Prefer chaining `git add -- <files> && git commit` in one shell call. Consider building in an isolated worktree.

---

## Task 1: Content module `aboutContent.js`

**Files:**
- Create: `client/src/components/about/aboutContent.js`

- [ ] **Step 1: Create the content module** with every section's copy/data as exported constants. Bracketed numbers = swap round-2; placeholder text marked.

```js
// All About-page copy + data. Round-2: replace placeholders / [bracketed] values + wire real photos.
export const hero = {
  h1: "Your time is worth protecting. So we built the calm way to get booked.",
  sub: "Book A Sloth helps creators publish their services, get booked, and get paid — without chasing DMs or losing a cut to commission.",
  ctaPrimary: "Let's Get Started",
  ctaGhost: "See how it works",
};

export const problem = {
  heading: "Getting booked shouldn't feel like a second job.",
  rows: [
    { pain: 'Endless "what time works?" DMs', fix: "One link. They pick. Done." },
    { pain: "Platforms taking a cut of every booking", fix: "0% commission. You keep it all." },
    { pain: "No-shows and forgotten sessions", fix: "Auto reminders + paid-upfront options." },
    { pain: "Your audience locked inside someone else's app", fix: "Your page, your customers, your data." },
  ],
};

export const story = {
  heading: "From a weekend hack to your calmest booking tool.",
  nodes: [
    { title: "The idea", body: "We were tired of watching creators lose time and money to clunky tools.", swap: "story-origin" },
    { title: "The prototype", body: "First booking link, built in a weekend." },
    { title: "First host", body: "Someone got paid before the first message. It worked." },
    { title: "Today", body: "Building the calmest way to run a booking business." },
  ],
};

export const beliefs = {
  heading: "What we believe.",
  items: [
    { title: "Time should never be wasted.", body: "Every tap removed is a minute given back." },
    { title: "Software should simplify, not complicate.", body: "If it needs a tutorial, we failed." },
    { title: "Creators should own their audience.", body: "Your customers are yours. Always." },
    { title: "Automation should feel invisible.", body: "The best tool is the one you forget is there." },
    { title: "Calm beats hustle.", body: "Work slower. Earn smarter." },
  ],
};

export const behind = {
  heading: "Made by people who hate busywork as much as you do.",
  sub: "No stock photos. Real workspace, real process — swap these for the real thing soon.",
  tiles: [
    { caption: "Whiteboard sessions", swap: "behind-1" },
    { caption: "Real support", swap: "behind-2" },
    { caption: "Shipping weekly", swap: "behind-3" },
  ],
};

// HONEST framing only — no invented customer counts. [bracketed] = swap real value round-2.
export const stats = {
  heading: "The calm, by the numbers.",
  items: [
    { value: 0, suffix: "%", label: "commission, ever" },
    { value: 99.9, suffix: "%", label: "uptime" },
    { value: 24, prefix: "<", suffix: "h", label: "support response", swap: "stat-support" },
    { value: 1, suffix: "+", label: "countries ready", swap: "stat-countries" },
    { value: 1, suffix: "", label: "years building", swap: "stat-years" },
  ],
};

export const team = {
  heading: "The people behind Book A Sloth.",
  sub: "Small team, big care. Real faces coming soon.",
  members: [
    { name: "Founder Name", role: "Founder", quip: "Believes the best software disappears.", swap: "team-1" },
    { name: "Team Member", role: "Product & Design", quip: "Removes a tap a day.", swap: "team-2" },
    { name: "Team Member", role: "Engineering", quip: "Ships on Fridays anyway.", swap: "team-3" },
  ],
};

export const build = {
  heading: "How we build.",
  steps: [
    { title: "Listen", body: "Talk to creators. A lot." },
    { title: "Research", body: "Find the real friction." },
    { title: "Prototype", body: "Make it real fast." },
    { title: "Build", body: "Ship it small." },
    { title: "Launch", body: "Put it in your hands." },
    { title: "Improve", body: "Then do it again." },
  ],
};

export const trust = {
  heading: "Built to be trusted.",
  cards: [
    { title: "Encrypted by default", body: "Your data is protected in transit and at rest." },
    { title: "Payments you can trust", body: "Razorpay-secured. Money handled right." },
    { title: "Always backed up", body: "Regular backups. Nothing lost." },
    { title: "Privacy-first", body: "We never sell your data. Export anytime." },
  ],
};

export const faq = {
  heading: "Questions, answered.",
  items: [
    { q: "Who are you?", a: "A small team building the calmest way for creators to get booked and paid. [Swap with real team note round-2.]" },
    { q: "Where are you based?", a: "[Placeholder — add real HQ/location round-2.]" },
    { q: "How do you handle my data?", a: "Encrypted in transit and at rest, never sold, and exportable anytime." },
    { q: "Can I export everything?", a: "Yes. Your bookings and customer data are yours to take with you." },
    { q: "How fast is support?", a: "We aim to reply within [a day]. [Swap with real SLA round-2.]" },
    { q: "How often do you ship updates?", a: "Constantly — small improvements land every week." },
  ],
};

export const finalCta = {
  heading: "Your calmer booking business starts today.",
  sub: "Set up your page in minutes. Keep 100% of what you earn.",
  ctaPrimary: "Let's Get Started",
  ctaGhost: "Become a host",
};

// Reuse homepage testimonials. Round-2: de-dup with Home source.
export const testimonials = {
  heading: "Loved by the people who use it.",
  // TODO during Task 11: copy the exact testimonial array from Home.jsx here.
  items: [],
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/about/aboutContent.js && git commit -m "feat(about): centralized content module with placeholders"
```

---

## Task 2: `Placeholder.jsx` swappable tile

**Files:**
- Create: `client/src/components/about/Placeholder.jsx`

- [ ] **Step 1: Implement** a gradient/initials placeholder matching `HeroFace`/`ProductMock` look. Props: `label`, `swap` (→ `data-swap`), `shape` ("tile"|"avatar"), `className`. Renders an accessible decorative tile with a small "Placeholder" hint.

```jsx
const GRADIENTS = [
  "linear-gradient(135deg,#FFE9DD,#FFD2BC)",
  "linear-gradient(135deg,#E8EEFF,#D6E0FF)",
  "linear-gradient(135deg,#EDE7FF,#DCD0FF)",
  "linear-gradient(135deg,#E2F6F4,#CFEFEA)",
];

export default function Placeholder({ label = "", swap, shape = "tile", className = "" }) {
  const initials = label.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const grad = GRADIENTS[(label.length || swap?.length || 0) % GRADIENTS.length];
  const round = shape === "avatar" ? "rounded-full" : "rounded-[6px]";
  return (
    <div
      data-swap={swap}
      role="img"
      aria-label={label ? `Placeholder for ${label}` : "Placeholder image"}
      className={`relative flex items-center justify-center overflow-hidden ${round} ${className}`}
      style={{ background: grad }}
    >
      <span className="font-heading text-2xl font-extrabold text-ink/50">{initials || "BAS"}</span>
      <span className="absolute bottom-1 right-2 text-[9px] font-semibold uppercase tracking-wide text-ink/30">
        placeholder
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): swappable Placeholder tile"`

---

## Task 3: `AboutFaq.jsx` (TDD — accordion logic)

**Files:**
- Create: `client/src/components/about/AboutFaq.jsx`
- Test: `client/src/components/about/__tests__/AboutFaq.test.jsx`

- [ ] **Step 1: Write failing test**

```jsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AboutFaq from "../AboutFaq";

describe("AboutFaq", () => {
  it("opens one panel on click and toggles closed", () => {
    render(<AboutFaq />);
    const first = screen.getByRole("button", { name: /who are you/i });
    expect(first).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "false");
  });

  it("single-open: opening a second closes the first", () => {
    render(<AboutFaq />);
    const a = screen.getByRole("button", { name: /who are you/i });
    const b = screen.getByRole("button", { name: /where are you based/i });
    fireEvent.click(a);
    fireEvent.click(b);
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(b).toHaveAttribute("aria-expanded", "true");
  });
});
```

- [ ] **Step 2: Run, expect fail** — Run: `cd client && npx vitest run src/components/about/__tests__/AboutFaq.test.jsx` Expected: FAIL (module not found).

- [ ] **Step 3: Implement** dark single-open accordion using `faq` from content, lucide `Plus` rotating.

```jsx
import { useState } from "react";
import { Plus } from "lucide-react";
import Reveal from "../home/Reveal";
import { faq } from "./aboutContent";

export default function AboutFaq() {
  const [open, setOpen] = useState(-1);
  return (
    <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-4xl">{faq.heading}</Reveal>
        <div className="mt-8 divide-y divide-white/10 border-y border-white/10">
          {faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-heading text-lg font-semibold">{item.q}</span>
                  <Plus className={`h-5 w-5 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-45" : ""}`} />
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

- [ ] **Step 4: Run, expect pass** — same command. Expected: PASS.
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(about): FAQ accordion (single-open, dark)"`

---

## Task 4: `StatStrip.jsx` (TDD — odometer final value)

**Files:**
- Create: `client/src/components/about/StatStrip.jsx`
- Test: `client/src/components/about/__tests__/StatStrip.test.jsx`

- [ ] **Step 1: Failing test** — assert all stat labels + final formatted values render.

```jsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatStrip from "../StatStrip";

describe("StatStrip", () => {
  it("renders every stat label and its final value", () => {
    render(<StatStrip />);
    expect(screen.getByText(/commission, ever/i)).toBeInTheDocument();
    expect(screen.getByText(/uptime/i)).toBeInTheDocument();
    expect(screen.getByText("99.9%")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("<24h")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect fail.** Run: `cd client && npx vitest run src/components/about/__tests__/StatStrip.test.jsx`

- [ ] **Step 3: Implement.** Dark strip. Use `useReducedMotion` + framer `animate` count-up on scroll-in (`whileInView`), but ALWAYS render the final formatted string as text node (so test + reduced-motion + SSR safe). Keep it simple: render final value; animate via CSS/Framer opacity only — do not depend on rolling-digit DOM for correctness.

```jsx
import { motion, useReducedMotion } from "framer-motion";
import Reveal from "../home/Reveal";
import { stats } from "./aboutContent";

const fmt = (s) => `${s.prefix || ""}${s.value}${s.suffix || ""}`;

export default function StatStrip() {
  const reduce = useReducedMotion();
  return (
    <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="text-center font-heading text-3xl font-bold sm:text-4xl">{stats.heading}</Reveal>
        <div className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {stats.items.map((s, i) => (
            <motion.div
              key={i}
              data-swap={s.swap}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="text-center"
            >
              <div className="font-heading text-4xl font-extrabold tracking-tight">{fmt(s)}</div>
              <div className="mt-2 text-sm text-white/60">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat(about): honest by-the-numbers stat strip"`

---

## Task 5: `AboutHero.jsx`

**Files:**
- Create: `client/src/components/about/AboutHero.jsx`

- [ ] **Step 1: Implement.** Warm-canvas 2-col hero. Reuse homepage CTA target (inspect Home hero CTA for the exact `to`). Floating placeholder cards with `sloth-float`.

```jsx
import { Link } from "react-router-dom";
import Reveal from "../home/Reveal";
import Placeholder from "./Placeholder";
import { hero } from "./aboutContent";

export default function AboutHero() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <Reveal as="h1" className="font-heading text-4xl font-extrabold leading-[1.1] sm:text-5xl lg:text-6xl">
            {hero.h1}
          </Reveal>
          <Reveal as="p" delay={0.08} className="mt-5 max-w-xl text-lg text-ink/70">{hero.sub}</Reveal>
          <Reveal delay={0.16} className="mt-8 flex flex-wrap gap-3">
            {/* TODO: match homepage "Let's Get Started" destination */}
            <Link to="/host/get-started" className="btn inline-flex items-center justify-center bg-primary-cta px-6 py-3 text-white hover:-translate-y-0.5">
              {hero.ctaPrimary}
            </Link>
            <a href="#how-we-build" className="btn btn--outline px-6 py-3">{hero.ctaGhost}</a>
          </Reveal>
        </div>
        <div className="relative hidden h-80 lg:block" aria-hidden="true">
          <Placeholder swap="hero-main" label="Hero" className="absolute inset-6 sloth-float--slow" />
          <Placeholder swap="hero-card-1" label="Paid" className="sloth-float absolute left-0 top-4 h-24 w-40 shadow-[var(--shadow-hard-1)]" />
          <Placeholder swap="hero-card-2" label="Booked" className="sloth-float--mid absolute bottom-2 right-0 h-24 w-44 shadow-[var(--shadow-hard-1)]" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): hero section"`

> NOTE: Verify the CTA `to="/host/get-started"` against the real homepage CTA during Task 13 preview; correct if different.

---

## Task 6: `ProblemSplit.jsx`

**Files:** Create `client/src/components/about/ProblemSplit.jsx`

- [ ] **Step 1: Implement.** 2-col cards: strikethrough pain → solution, dashed separator (reuse Home Problem→Solution look).

```jsx
import { ArrowRight } from "lucide-react";
import Reveal from "../home/Reveal";
import { problem } from "./aboutContent";

export default function ProblemSplit() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="max-w-2xl font-heading text-3xl font-bold sm:text-4xl">{problem.heading}</Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {problem.rows.map((r, i) => (
            <Reveal key={i} delay={i * 0.06} className="rounded-[6px] border border-ink/10 bg-surface p-6">
              <p className="text-ink/40 line-through">{r.pain}</p>
              <div className="my-3 border-t border-dashed border-ink/15" />
              <p className="flex items-start gap-2 font-semibold text-ink">
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary" />
                {r.fix}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): problem split section"`

---

## Task 7: `StoryTimeline.jsx`

**Files:** Create `client/src/components/about/StoryTimeline.jsx`

- [ ] **Step 1: Implement.** Dark vertical timeline; nodes reveal in sequence; left rail with dots.

```jsx
import Reveal from "../home/Reveal";
import { story } from "./aboutContent";

export default function StoryTimeline() {
  return (
    <section className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-4xl">{story.heading}</Reveal>
        <ol className="mt-10 space-y-8 border-l border-white/15 pl-8">
          {story.nodes.map((n, i) => (
            <Reveal as="li" key={i} delay={i * 0.08} className="relative" {...(n.swap ? { "data-swap": n.swap } : {})}>
              <span className="absolute -left-[37px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-ink" />
              <h3 className="font-heading text-lg font-semibold">{n.title}</h3>
              <p className="mt-1 text-white/70">{n.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): story timeline"`

---

## Task 8: `BeliefGrid.jsx`

**Files:** Create `client/src/components/about/BeliefGrid.jsx`

- [ ] **Step 1: Implement.** Icon grid, one `--c-*` accent per card.

```jsx
import { Clock, Wand2, Users, EyeOff, Leaf } from "lucide-react";
import Reveal from "../home/Reveal";
import { beliefs } from "./aboutContent";

const ICONS = [Clock, Wand2, Users, EyeOff, Leaf];
const ACCENTS = ["var(--c-blue)", "var(--c-violet)", "var(--c-cyan)", "var(--c-emerald)", "var(--c-amber)", "var(--c-pink)"];

export default function BeliefGrid() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-4xl">{beliefs.heading}</Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {beliefs.items.map((b, i) => {
            const Icon = ICONS[i % ICONS.length];
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <Reveal key={i} delay={i * 0.05} className="rounded-[6px] border border-ink/10 bg-surface p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[6px]" style={{ background: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-heading text-lg font-semibold">{b.title}</h3>
                <p className="mt-1 text-ink/70">{b.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): beliefs grid"`

---

## Task 9: `BehindProduct.jsx`

**Files:** Create `client/src/components/about/BehindProduct.jsx`

- [ ] **Step 1: Implement.** 3 placeholder tiles with captions.

```jsx
import Reveal from "../home/Reveal";
import Placeholder from "./Placeholder";
import { behind } from "./aboutContent";

export default function BehindProduct() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="max-w-2xl font-heading text-3xl font-bold sm:text-4xl">{behind.heading}</Reveal>
        <Reveal as="p" delay={0.06} className="mt-3 max-w-xl text-ink/70">{behind.sub}</Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {behind.tiles.map((t, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <Placeholder swap={t.swap} label={t.caption} className="h-48 w-full" />
              <p className="mt-3 font-semibold text-ink">{t.caption}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): behind the product"`

---

## Task 10: `TeamGrid.jsx`

**Files:** Create `client/src/components/about/TeamGrid.jsx`

- [ ] **Step 1: Implement.** Profile cards with placeholder avatars.

```jsx
import Reveal from "../home/Reveal";
import Placeholder from "./Placeholder";
import { team } from "./aboutContent";

export default function TeamGrid() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-4xl">{team.heading}</Reveal>
        <Reveal as="p" delay={0.06} className="mt-3 max-w-xl text-ink/70">{team.sub}</Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {team.members.map((m, i) => (
            <Reveal key={i} delay={i * 0.06} className="rounded-[6px] border border-ink/10 bg-surface p-6 text-center transition-transform hover:-translate-y-1">
              <Placeholder swap={m.swap} label={m.name} shape="avatar" className="mx-auto h-20 w-20" />
              <h3 className="mt-4 font-heading text-lg font-semibold">{m.name}</h3>
              <p className="text-sm text-primary">{m.role}</p>
              <p className="mt-2 text-sm text-ink/60">{m.quip}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): team grid"`

---

## Task 11: `BuildFlow.jsx`

**Files:** Create `client/src/components/about/BuildFlow.jsx`

- [ ] **Step 1: Implement.** Dark step flow, numbered, connectors horizontal desktop / vertical mobile.

```jsx
import Reveal from "../home/Reveal";
import { build } from "./aboutContent";

export default function BuildFlow() {
  return (
    <section id="how-we-build" className="bg-ink px-5 py-20 text-white sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-4xl">{build.heading}</Reveal>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {build.steps.map((s, i) => (
            <Reveal as="li" key={i} delay={i * 0.05} className="rounded-[6px] border border-white/10 bg-white/5 p-5">
              <span className="font-heading text-2xl font-extrabold text-primary">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 font-heading text-base font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-white/60">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): how-we-build flow"`

---

## Task 12: `TrustGrid.jsx`

**Files:** Create `client/src/components/about/TrustGrid.jsx`

- [ ] **Step 1: Implement.** 4 trust cards, lucide icons.

```jsx
import { Lock, CreditCard, DatabaseBackup, ShieldCheck } from "lucide-react";
import Reveal from "../home/Reveal";
import { trust } from "./aboutContent";

const ICONS = [Lock, CreditCard, DatabaseBackup, ShieldCheck];
const ACCENTS = ["var(--c-cyan)", "var(--c-emerald)", "var(--c-amber)", "var(--c-blue)"];

export default function TrustGrid() {
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-4xl">{trust.heading}</Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trust.cards.map((c, i) => {
            const Icon = ICONS[i % ICONS.length];
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <Reveal key={i} delay={i * 0.05} className="rounded-[6px] border border-ink/10 bg-surface p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[6px]" style={{ background: `color-mix(in srgb, ${accent} 14%, white)`, color: accent }}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold">{c.title}</h3>
                <p className="mt-1 text-sm text-ink/70">{c.body}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): security & reliability grid"`

---

## Task 13: `AboutTestimonials.jsx` + populate testimonials

**Files:**
- Modify: `client/src/components/about/aboutContent.js` (fill `testimonials.items`)
- Create: `client/src/components/about/AboutTestimonials.jsx`

- [ ] **Step 1: Find Home testimonials.** Open `client/src/pages/Home.jsx`, locate the testimonials data array (~lines 1593–1704 region). Copy the array (name, role, quote, avatar fields) into `testimonials.items` in `aboutContent.js`. Do NOT modify Home.

- [ ] **Step 2: Implement** a static testimonial card grid (carousel optional, not required) reusing the homepage card visual (quote, `TAvatar`-style initials fallback). If avatars are URLs use them; else initials fallback.

```jsx
import Reveal from "../home/Reveal";
import { testimonials } from "./aboutContent";

function Avatar({ name, src }) {
  const initials = (name || "").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return src ? (
    <img src={src} alt={name} className="h-10 w-10 rounded-full object-cover" />
  ) : (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light font-semibold text-primary-cta">{initials}</span>
  );
}

export default function AboutTestimonials() {
  if (!testimonials.items.length) return null;
  return (
    <section className="px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal as="h2" className="font-heading text-3xl font-bold sm:text-4xl">{testimonials.heading}</Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.items.map((t, i) => (
            <Reveal key={i} delay={i * 0.05} className="rounded-[6px] border border-ink/10 bg-surface p-6">
              <p className="text-ink/80">"{t.quote}"</p>
              <div className="mt-4 flex items-center gap-3">
                <Avatar name={t.name} src={t.avatar} />
                <div>
                  <div className="font-semibold text-ink">{t.name}</div>
                  <div className="text-sm text-ink/50">{t.role}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

> NOTE: match the exact field names from Home's array (e.g. it may be `text`/`author`/`title` not `quote`/`name`/`role`). Adapt the JSX field names to whatever Home uses. If Home renders 3× tripled list, copy only the unique single list.

- [ ] **Step 3: Commit** `git add -A && git commit -m "feat(about): testimonials reused from homepage"`

---

## Task 14: `FinalCta.jsx`

**Files:** Create `client/src/components/about/FinalCta.jsx`

- [ ] **Step 1: Implement.** Warm aura close, big orange CTA. Match "Become a host" CTA target to homepage/footer.

```jsx
import { Link } from "react-router-dom";
import Reveal from "../home/Reveal";
import { finalCta } from "./aboutContent";

export default function FinalCta() {
  return (
    <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8 lg:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(60% 60% at 50% 40%, #FFE9DD 0%, transparent 70%)" }} aria-hidden="true" />
      <div className="mx-auto max-w-2xl">
        <Reveal as="h2" className="font-heading text-3xl font-extrabold sm:text-4xl lg:text-5xl">{finalCta.heading}</Reveal>
        <Reveal as="p" delay={0.08} className="mt-4 text-lg text-ink/70">{finalCta.sub}</Reveal>
        <Reveal delay={0.16} className="mt-8 flex flex-wrap justify-center gap-3">
          {/* TODO: match homepage CTA destinations */}
          <Link to="/host/get-started" className="btn inline-flex items-center justify-center bg-primary-cta px-7 py-3 text-white hover:-translate-y-0.5">{finalCta.ctaPrimary}</Link>
          <Link to="/host/get-started" className="btn btn--outline px-7 py-3">{finalCta.ctaGhost}</Link>
        </Reveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit** `git add -A && git commit -m "feat(about): final CTA"`

---

## Task 15: Compose `About.jsx` (TDD — render smoke)

**Files:**
- Modify (rewrite): `client/src/pages/About.jsx`
- Test: `client/src/pages/__tests__/About.test.jsx`

- [ ] **Step 1: Failing render-smoke test.** Render with router; assert key section headings present, no crash.

```jsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import About from "../About";

describe("About page", () => {
  it("renders all major sections without crashing", () => {
    render(<MemoryRouter><About /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/worth protecting/i);
    expect(screen.getByText(/what we believe/i)).toBeInTheDocument();
    expect(screen.getByText(/how we build/i)).toBeInTheDocument();
    expect(screen.getByText(/questions, answered/i)).toBeInTheDocument();
    expect(screen.getByText(/calmer booking business/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect fail** (About still placeholder). Run: `cd client && npx vitest run src/pages/__tests__/About.test.jsx`

- [ ] **Step 3: Rewrite `About.jsx`** composing all sections + `Seo`. Check existing `Seo.jsx` import path/props in another page (e.g. `pages/Service*` or `ProfilePage`) and match usage.

```jsx
import Seo from "../components/common/Seo"; // adjust path/props to match existing usage
import AboutHero from "../components/about/AboutHero";
import ProblemSplit from "../components/about/ProblemSplit";
import StoryTimeline from "../components/about/StoryTimeline";
import BeliefGrid from "../components/about/BeliefGrid";
import BehindProduct from "../components/about/BehindProduct";
import StatStrip from "../components/about/StatStrip";
import TeamGrid from "../components/about/TeamGrid";
import BuildFlow from "../components/about/BuildFlow";
import TrustGrid from "../components/about/TrustGrid";
import AboutTestimonials from "../components/about/AboutTestimonials";
import AboutFaq from "../components/about/AboutFaq";
import FinalCta from "../components/about/FinalCta";

export default function About() {
  return (
    <main className="bg-[var(--bg)]">
      <Seo
        title="About Book A Sloth — the calm way to get booked"
        description="Why we exist, who we are, and how we help creators get booked and paid without commission."
      />
      <AboutHero />
      <ProblemSplit />
      <StoryTimeline />
      <BeliefGrid />
      <BehindProduct />
      <StatStrip />
      <TeamGrid />
      <BuildFlow />
      <TrustGrid />
      <AboutTestimonials />
      <AboutFaq />
      <FinalCta />
    </main>
  );
}
```

- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Full client test + build.** Run: `cd client && npx vitest run && npm run build` Expected: all green, build succeeds.
- [ ] **Step 6: Commit** `git add -A && git commit -m "feat(about): compose About page from sections"`

---

## Task 16: Live preview verification + CTA/Seo correction

- [ ] **Step 1:** Start dev server (`preview_start`), navigate `/about`.
- [ ] **Step 2:** `preview_console_logs` — zero errors. `preview_snapshot` — all 12 sections render, alternating white/dark.
- [ ] **Step 3:** Verify CTA destinations match homepage's real "Let's Get Started"/"Become a host" routes; fix the `to=` placeholders in `AboutHero`/`FinalCta` if they differ. Verify `Seo` import path/props compile.
- [ ] **Step 4:** `preview_resize` mobile (375px) — single-column, connectors vertical, CTAs reachable. Dark mode if applicable.
- [ ] **Step 5:** `preview_screenshot` desktop + mobile for proof.
- [ ] **Step 6:** If any fix made, commit `git add -A && git commit -m "fix(about): correct CTA routes / Seo usage after preview"`.

---

## Self-Review notes (done)

- **Spec coverage:** all 12 spec sections → Tasks 5–15. Honest metrics (Task 4/§6), reuse testimonials (Task 13/§10), placeholders+`data-swap` (Tasks 1,2), reduced-motion (Reveal + StatStrip), SEO (Task 15), no Home refactor (Tasks 3,4,13 localize patterns).
- **Deferred (per spec, not tasks):** real photos/names/numbers (round-2 via `data-swap`+`aboutContent.js`), optional delight sections, testimonial de-dup.
- **Known adapt points flagged inline:** CTA `to=` destinations, `Seo` import/props, Home testimonial field names — all to confirm against real code in Tasks 13/15/16.
