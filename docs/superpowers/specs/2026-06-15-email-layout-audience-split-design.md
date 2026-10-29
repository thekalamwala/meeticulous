# Email Layout Audience Split — Design

**Date:** 2026-06-15
**Status:** Approved, ready for implementation plan
**Author:** Meeticulous + Claude

## Problem

`server/services/email/emailLayout.js` renders ONE email shell for every recipient.
Vendors and customers are at different relationship stages and take different actions,
so a single layout serves neither well:

- **Customers** are new to the platform — the email must build trust in *Meeticulous*
  itself, and offer navigation + a legal unsubscribe.
- **Vendors** already know the brand — the email should lead with *their own* brand and
  stay lean (their own booking notification, "Powered by Meeticulous" in the footer).

## Goal

Two distinct email layouts — one for customers, one for vendors — selected automatically
per recipient, sharing the same template bodies. Adopt the refined visual language from
the vendor "new booking" email the team already uses.

## Decisions (locked)

| # | Decision |
|---|----------|
| 1 | Trust-stage **and** tone differ between the two audiences. |
| 2 | **Fully distinct headers** (different logo identity), clean header = logo + name + chip only (no tagline / no trust strip). |
| 3 | Customer footer = nav row + legal block. Vendor footer = minimal "Powered by" + legal, **no nav**. |
| 4 | Footer links point to their **final routes now**; unbuilt pages (`/help`, `/privacy`, `/unsubscribe`) are built later by the team pre-launch (task chip `task_83c19d1a`). |
| 5 | Customer header logo = **Meeticulous** logo image + "Meeticulous" wordmark. Vendor header logo = **host's own** `{{company_logo}}` + host name. |
| 6 | Two layouts **hardcoded** in `emailLayout.js` (Option A). Tokens still come from `email_settings`. No DB migration, no admin UI. |
| 7 | Layout selected by the **recipient** (`opts.audience`), NOT the template row tag (`template.audience`). Default → customer layout. |

## Visual DNA (from the team's existing vendor booking email)

- Card: max-width 600px, white, `1px solid #edf0f2` border, `border-radius:14px`, overflow hidden.
- **4px top accent bar** in `brand_color`.
- **Header:** logo (48px, `border-radius:10px`) + name (15px/600) + **dynamic sub-label**
  (12px `#80868b`, fed by `email_category`) on the left; **pill chip** on the right
  (`brand_color` at ~7% alpha background, `brand_color` text, `border-radius:999px`).
- **Body:** rendered template body + optional block CTA.
- **CTA:** full-width block, `brand_color` background, white text, `border-radius:10px`.
- **Footer:** centered, 11px `#9aa0a6`, "Powered by" + Meeticulous footer-logo
  (`https://company-assets.meeticulous.in/images/email/footer-logo.png`, 60px) +
  legal entity + address + © year.

> **Outlook note:** the existing design uses 8-digit hex alpha (`{{primary_color}}12`).
> Outlook desktop may not render 8-digit hex. Implementation should produce the tint with
> a precomputed solid hex (or a nested table cell) rather than relying on alpha hex, to keep
> the chip background visible in Outlook. Verify in the review.

## Architecture

### Components

**`emailLayout.js`** — exports two render functions plus a selector:

- `renderCustomerLayout(opts)` — Meeticulous-branded, nav + legal footer.
- `renderVendorLayout(opts)` — host-branded, minimal "Powered by" footer.
- `renderLayout(opts)` — thin dispatcher: reads `opts.audience`, delegates to the right
  variant. Keeps a single import surface for `communicationEngine`.

Both variants share private helpers for the pieces that are identical (top accent bar,
card wrapper, CTA button, escaping) so the two functions differ only where they should
(header logo/name source, footer content). Shared helpers prevent the two from drifting.

**`communicationEngine.renderEmail`** — passes the recipient audience into the layout:

```js
function renderEmail(template, { data = {}, user = {}, settings, audience = 'all' }) {
  const globals = buildGlobals(settings, user);
  const r = resolveTemplate(template, data, globals);
  const html = renderLayout({
    audience,                          // <-- recipient-driven selection
    bodyHtml: r.html,
    previewText: data.preview_text || template.preview_text || '',
    ctaLabel: r.ctaLabel, ctaUrl: r.ctaUrl, settings,
    emailCategory: template.email_category || '',
    emailReason: template.email_reason || '',
    data,                              // host logo/name (company_logo, company_name)
  });
  return { subject: r.subject, html, missing: r.missing };
}
```

`send()` and `enqueueCampaignEmail()` pass their `audience` through to `renderEmail`.
(`send()` already has `opts.audience`; thread it into the `renderEmail` call.)

### Selection rule

```
opts.audience === 'vendor'  -> renderVendorLayout
opts.audience === 'customer'-> renderCustomerLayout
otherwise ('all' | null)    -> renderCustomerLayout   (safe, platform-branded, has unsubscribe)
```

Rationale: layout is about the *reader*. `'all'` is a template-body tag (one body, both
readers), not a recipient type, so it cannot drive the shell. Defaulting to the customer
layout fails safe — it is platform-branded and carries the legal unsubscribe link; a vendor
mistakenly receiving customer chrome is cosmetic only.

### Layout contracts

**Customer layout**
- Top accent: 4px `settings.brand_color`.
- Header: `settings.logo_url` (Meeticulous logo) + "Meeticulous" wordmark (left) +
  dynamic sub-label (`emailCategory`) + pill chip (right). Falls back to wordmark text if
  `logo_url` empty.
- Body + optional CTA.
- Footer:
  - Nav row: **My Bookings** (`/my-bookings`) · **Help** (`/help`) · **Privacy** (`/privacy`) · **Unsubscribe** (`/unsubscribe?u={{unsubscribe_token}}`).
  - Legal block: "Powered by" Meeticulous footer-logo + `Timewheel Internet (P) Ltd` + address + support email + © year.
  - Unsubscribe URL includes an `{{unsubscribe_token}}` placeholder slot (resolves to empty until the mechanism ships; link target built later).

**Vendor layout**
- Top accent: 4px `settings.brand_color`.
- Header: `data.company_logo` (host's logo) + `data.company_name` (left) + dynamic sub-label + pill chip (right). Falls back to `settings.logo_url` / `from_name` if host values absent.
- Body + optional CTA.
- Footer (minimal, matches existing design): "Powered by" Meeticulous footer-logo + legal entity + address + © year. **No nav links.**

### Tokens & data sources

| Value | Source |
|-------|--------|
| `brand_color`, `website_url`, `support_email`, `from_name`, `logo_url` | `email_settings` (via `settings`) |
| Meeticulous footer-logo URL | constant in `emailLayout.js` (matches existing asset URL) |
| Host logo / name | template `data.company_logo` / `data.company_name` |
| `emailCategory`, `emailReason` | template row |

### Call-site audit (required)

Layout is recipient-driven, so every place that emails a **host/vendor** must pass
`audience:'vendor'`. Audit:

- All `communicationEngine.send({ ... })` call sites.
- All `NotificationEngine.send({ ... })` call sites whose email path reaches a host.

For each host-bound send, ensure `audience:'vendor'` is set. A missed one is cosmetic
(host gets Meeticulous chrome instead of their own) but should be corrected. Document the
list of audited call sites in the implementation.

## Data flow

```
business event
  -> communicationEngine.send({ event, to, audience, data, user })
  -> getTemplate(event, audience)            # body selection (existing)
  -> renderEmail(template, { data, user, settings, audience })
       -> resolveTemplate (placeholders, existing)
       -> renderLayout({ audience, ... })    # NEW: recipient-driven shell
            -> renderCustomerLayout | renderVendorLayout
  -> queue / immediate / test (existing)
```

## Error handling & fallbacks

- Empty `logo_url` → customer header falls back to "Meeticulous" wordmark text (existing pattern).
- Empty `data.company_logo` / `data.company_name` → vendor header falls back to `settings.logo_url` / `from_name`.
- Unknown / missing `audience` → customer layout.
- `{{unsubscribe_token}}` unresolved → renders empty; link still present (target page built later). Acceptable pre-launch; flagged in the page-build task.

## Testing

- **Unit (`emailLayout`):** customer layout contains Meeticulous logo + nav links + unsubscribe; vendor layout contains host logo + no nav links + "Powered by". Both contain the 4px accent and the card wrapper.
- **Unit (`communicationEngine.renderEmail`):** `audience:'vendor'` → vendor chrome; `audience:'customer'` and `audience:'all'` and missing → customer chrome; same template body present in both.
- **Regression:** existing `communicationEngine` / campaign tests still green (template body, queue, retry unaffected).
- **Manual:** test-send one customer-audience and one vendor-audience template; verify in Gmail + Outlook (chip tint visible, logos load, footer correct).

## Out of scope

- No DB migration, no `email_settings` columns, no admin UI (Option A).
- No new or edited template bodies.
- No unsubscribe backend, token generation, or opt-out enforcement (separate pre-launch task `task_83c19d1a`).
- No `/help`, `/privacy`, `/unsubscribe` page builds (same task).
- No tone/copy rewrites of template bodies (handled separately via the `audience`-tagged template rows).

## Affected files

- `server/services/email/emailLayout.js` — split into two layouts + dispatcher (primary change).
- `server/services/email/communicationEngine.js` — thread `audience` into `renderEmail` / `renderLayout`; `send()` and `enqueueCampaignEmail()` pass it through.
- Host-bound call sites (from the audit) — add `audience:'vendor'`.
- `server/tests/unit/` — new layout tests + updated engine tests.
