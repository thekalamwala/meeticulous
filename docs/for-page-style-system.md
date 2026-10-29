# /for/ Page Style System

The design playbook for bespoke profession landing pages (`/for/<slug>`). Every
page follows the **CharteredAccountants section order** but each section is a
**genuinely different design** — never a recoloured clone. Only the shared shell
(nav, hero, footer) may resemble sibling pages (~20% overlap max).

## Section order (from CharteredAccountants.jsx)
1. Nav *(shared shell)*
2. Hero *(≤20% shared)*
3. Use-cases / services
4. How it works
5. Integrations
6. Impact
7. Testimonials
8. The difference (comparison)
9. Trust
10. Pricing
11. About
12. FAQ
13. Final CTA
14. Footer *(shared shell)*

## Style library (systems to draw from)
| # | System | Signature | Best-fit audience |
|---|--------|-----------|-------------------|
| A | Trust-Blue | blue accent, light bg, real photos, stat cards, dotted-map | high-stakes: doctors, real estate, tutors |
| A′ | Blue photo-overlay hero | tinted full-bleed photo + white stat row + play | proof-heavy variant |
| B | Calm-Green | green accent, cream, pill buttons, avatar-count pill | wellness/care |
| C | Dark-Bold | near-black, orange, numbered cards, squared icons | creative energy |
| D | Corporate charcoal+amber *(consultants — done)* | slate + amber, tight, dashboardy | serious B2B |
| E | Playful Cream *(designpro)* | cream, orange+black, hand-drawn doodles, pill nav | approachable premium |
| F | Dark Gradient SaaS *(hexus)* | navy→purple, indigo, floating nav, chart cards | modern/techy |
| G | Editorial Forest-Green *(aximo/mortar)* | deep green, cream oversized type, yellow accent, device mockups | sophisticated advisory |
| H | Light + Lime *(diligent)* | white, lime highlight marker, arched photo frames, teal | fresh, energetic, active |

## 12-page plan (medical + wellness — nav-confirmed via open PRs)
| Page | Audience taste | System | Accent |
|------|----------------|--------|--------|
| General Physicians & Clinics | credibility, safety | A Trust-Blue | medical blue |
| Dermatologists & Skin Clinics | clinical + skin/beauty | A Trust-Blue | cool teal |
| Gynecologists & OB-GYNs | caring, private | B Calm-Green | rose-teal |
| Pediatricians & Child Care | safe + friendly | A Trust-Blue (warm) | sky-blue |
| ENT Specialists & Surgeons | clinical authority | A Trust-Blue | indigo |
| Ophthalmologists & Eye Clinics | clarity, precision | A′ photo-overlay | crisp cyan |
| Physiotherapists & Rehab | active recovery | **H Light + Lime** | **teal-lime** ✅ template built |
| Nutritionists & Dietitians | fresh, healthy | B Calm-Green | leaf-green |
| Life & Wellness Coaches | warm growth | G Editorial Green | sage |
| Spas & Wellness Centres | serene, premium | G Editorial Green | sage/stone |
| Salons & Beauticians | beauty, warm | E Playful Cream | rose/mauve |
| Veterinarians & Pet Clinics | warm, caring | E Playful Cream | terracotta/amber |

## Guardrails (every page, non-negotiable)
- **Honest data only** — no fabricated counts, no health-outcome claims. Trust comes
  from Razorpay/DPDP/Mumbai-hosting/0%-commission facts. Testimonials are labelled
  placeholders about the *software's* admin benefit.
- **No uplift/scale hover** on `/for/*` pages.
- **Design tokens** (legacy `--ca-*` names retuned per page), Plus Jakarta headings /
  Poppins body. One accent per page.
- **Animate content, not containers.** Vary the animation per section.
- **Empty images** = styled `ImgSlot` placeholders with descriptive `aria-label`;
  layout is final, real photos drop in later.
- **a11y:** single `<h1>` → ordered `h2/h3`, real `<button>`/`<a>`, aria-labels on
  marquee/accordion/toggle, `prefers-reduced-motion` disables every marquee/float,
  AA contrast (dark text on lime — never lime body text on white), visible focus.
- **SEO:** `<title>` = H1-aligned + primary keyword + brand · meta description ·
  keywords · canonical · OG + Twitter (image = placeholder path) · JSON-LD
  **SoftwareApplication + Service + FAQPage + BreadcrumbList** (no aggregateRating).
- **AEO/GEO:** answer-first FAQ copy (feeds FAQPage schema), entity clarity
  (profession · India), concise "speakable" answers.

## Template reference
`client/src/pages/for/Physiotherapists.jsx` — Style H, all 14 sections uniquely
designed (numbered treatment index · recovery-journey track · two-row logo marquee ·
asymmetric bento · vertical quote wall · split old-vs-new panels · trust ticker ·
horizontal pricing bars · arched about cluster). Clone the *scaffold + quality bar*,
not the visuals — each of the remaining 11 gets its own section designs per its system.

## Workflow
Per page: style-spec → approve → pull PR branch → build → verify (browser + DOM) →
commit → push to its PR. Never merge — the founder controls the release train.
