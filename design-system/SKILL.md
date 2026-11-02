---
name: meeticulous-design
description: Use this skill for ANY Meeticulous design or front-end work: website pages, product UI, emails, social graphics, decks. It holds the brand rules, design tokens, React components, logos, illustrations and patterns. Always follow BRAND_RULES.md. For restructuring the existing website, follow WEBSITE_MIGRATION.md.
user-invocable: true
---

# Meeticulous design skill

1. Read `BRAND_RULES.md` first. These rules are non-negotiable.
2. Read `readme.md` for the full guide (voice, visual foundations, iconography, asset index).
3. Use the tokens: link or import `styles.css` (it imports `tokens/*` and `components/components.css`). Never hard-code a hex, font, radius or shadow that a token already carries.
4. Use the components in `components/` (React, `.jsx` + `.d.ts` + `.prompt.md`) or their CSS classes (`.mt-btn`, `.mt-card`, `.mt-slot` …) from `components/components.css`.
5. Use the official files in `assets/`. Never redraw the logo, the ee, the camera+calendar icon or the illustrations.
6. Open `guidelines/*.html` in a browser for visual specimens of every foundation.
7. When restructuring the website, follow `WEBSITE_MIGRATION.md` step by step.

If invoked without a task, ask what the user wants to build (page, component, email, social, deck), then build it in this system.
