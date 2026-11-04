# Weekly SEO/AEO audit — 2026-11-04 (Sumant, ASH-6)

Delta vs the baseline `docs/seo-aeo-audit.md` (2026-10-04). Read-only: live HTTP probes only
(`curl -sI` / status+size). **No DB access** (Sumant has none) → platform-scale table not refreshed
(baseline: 82 hosts, 49 bookings, 6 reviews). Full `geo-audit` not run (1st-week-of-month item; only
partially covered here — see "Not done").

## Live probes (2026-11-04 ~04:50 UTC, https://meeticulous.com)

| Route | Status | Served as | Bytes | Prerendered? |
|---|---|---|---|---|
| `/` | 200 (3.07s TTFB-total, slow) | — | — | yes |
| `/pricing` | 200 | `pricing` | 196,048 | yes |
| `/about` | 200 | `about` | 227,264 | yes |
| `/blog` | 200 | **`spa-shell.html`** | 5,559 | **NO** |
| `/services` | 200 | **`spa-shell.html`** | 5,559 | **NO** |
| `/compare/calendly-alternative` | 200 | **`spa-shell.html`** | 5,559 | **NO** |
| `/for/doctors` | 200 | **`spa-shell.html`** | 5,559 | **NO** |
| `/glossary/buffer-time` | 200 | **`spa-shell.html`** | 5,559 | **NO** |
| `/blog/topmate-alternative` | 301 → `/compare/topmate-alternative` | — | — | redirect OK (`client/vercel.json:13`) |
| `/sitemap.xml` | 200, `application/xml`, ETag `W/"228"` ≈ 552 B | Render API | — | tiny (index?) |
| `/robots.txt`, `/llms.txt` | 200 | — | — | ok |
| API `/health` | `{"status":"ok"}` | — | — | ok |

## Finding W1 (P0) — key money/hub routes ship the bare SPA shell

**Gap:** `/blog`, `/services`, `/compare/*`, `/for/*`, `/glossary/*` return the generic shell
(`Content-Disposition: spa-shell.html`, 5.5 KB) instead of prerendered HTML, although all are in
`PRERENDER_ROUTES` (`client/scripts/prerender.mjs:91` for `/blog`). `/pricing` and `/about` are
prerendered fine, so the build ran — the later routes dropped.
**Evidence:** header probes above (shell ETag `8dd3f37c…` identical across all five; last build
`Last-Modified: 2026-11-04 03:21 GMT`). Likely mechanism, per comments in `prerender.mjs`: time-budget
skip (`skipped` list, ~:443) or API rate-limit / missing `PRERENDER_BUILD_TOKEN` (`:401-409`) leaving
later routes unrendered. Not confirmed — needs the Vercel build log.
**Impact:** H — non-JS crawlers (Bing, most AI crawlers: GPTBot/ClaudeBot/PerplexityBot) see an empty
page with the homepage-agnostic shell for the compare/for/blog money pages; Google renders JS so is
less affected. Directly undermines the GEO posture praised in the baseline.
**Fix → Senapati:** check the last deploy's prerender log (skipped/failed counts, token line), confirm
whether these routes are skipped; if time-budget, raise budget/order money routes first. Add the
fail-loud guard noted at `prerender.mjs:568-573` once build-IP reliability is fixed.
**Effort:** S–M. **Caveat:** I can only see headers, not bodies (tooling blocks piping). Please
re-check with `curl -s https://meeticulous.com/blog` and look for a real `<title>` / `<h1>`.

## Finding W2 (P1) — homepage 3.07s total time
Single sample, likely a cold edge. Re-sample; if persistent check LCP in Lighthouse (**[VERIFY LIVE]**).

## Finding W3 (P2) — sitemap body unverified
552-byte sitemap is consistent with a sitemap index (`/sitemap-:name.xml` rewrite, `vercel.json:20`),
but I could not read it. Verify each child sitemap lists the `/for`, `/compare`, `/glossary` routes.

## Carried over from baseline (status not re-verified this week)
Org `logo` 404, `/lp` pages without JSON-LD, 6 reviews vs hardcoded `aggregateRating` (P0-1 honesty
risk), supply/targeting mismatch. Check `docs/seo-aeo-audit.md` §Priority list; none re-checked
(need code diff + DB).

## Not done
DB scale/review checks (no access), Lighthouse/CWV, `geo-audit` skill (subagent-heavy; run next week or
on request), body-level schema validation of live pages.

## Tasks raised
- Senapati: investigate W1 (prerender skipping hub routes).
