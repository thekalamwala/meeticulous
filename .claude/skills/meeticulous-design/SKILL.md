---
name: meeticulous-design
description: Use this skill for ANY Meeticulous design or front-end work: website pages, product UI, emails, social graphics, decks. It holds the brand rules, design tokens, React components, logos, illustrations and patterns. Always follow BRAND_RULES.md. For restructuring the existing website, follow WEBSITE_MIGRATION.md.
user-invocable: true
---

# Meeticulous design skill

The kit lives in `design-system/` at the repo root. That folder is the single source of
truth: this skill only points at it, so there is no second copy to drift out of date.

1. Read `design-system/BRAND_RULES.md` first. These rules are non-negotiable.
2. Read `design-system/readme.md` for the full guide (voice, visual foundations, iconography, asset index).
3. Use the tokens: link or import `design-system/styles.css` (it imports `tokens/*` and
   `components/components.css`). In the client the kit is wired as `client/src/styles/brand.css`.
   Never hard-code a hex, font, radius or shadow that a token already carries.
4. Use the components in `design-system/components/` (React, `.jsx` + `.d.ts` + `.prompt.md`) or their
   CSS classes (`.mt-btn`, `.mt-card`, `.mt-slot` …) from `components/components.css`.
5. Use the official files in `design-system/assets/`. Never redraw the logo, the ee, the
   camera+calendar icon or the illustrations.
6. Open `design-system/guidelines/*.html` in a browser for visual specimens of every foundation.
7. Restructuring the website: follow `design-system/WEBSITE_MIGRATION.md`; remaining work is in
   `design-system/MIGRATION_AUDIT.md`. Mobile app screens: `design-system/MOBILE_APP_UI.md`.
8. For interaction polish on a new or reworked page (press/hover states, transitions, popovers),
   also load `emil-design-eng`.

If invoked without a task, ask what the user wants to build (page, component, email, social, deck),
then build it in this system.
