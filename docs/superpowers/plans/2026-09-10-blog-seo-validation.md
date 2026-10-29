# Blog SEO/GEO scorer + skill — dry-run validation

Date: 2026-09-10
Scope: validate `server/scripts/scoreBlogDraft.mjs` and `.claude/skills/blog-seo-optimizer/SKILL.md` against one real post. No source files modified, no PR opened.

## Post used
`digital-marketing-for-startups` (from `client/src/data/blogPosts.js`, first entry in the export — no slug argument passed). Exported via the one-liner from the task brief to `scratch/post.json` (gitignored/scratch-only, not committed).

## Self-check
`node server/scripts/scoreBlogDraft.mjs --selfcheck` → both checks PASS (`analyze+row`, `scoreDraft`).

## Baseline score
`node server/scripts/scoreBlogDraft.mjs scratch/post.json` → valid JSON, no crash.

- `seo.profile`: `"blog"` ✅ (confirms blog weight profile selected, not host/service)
- `seo.score`: **81**
- `geo.score`: **91**

Top recommendations (baseline):
1. **SEO / metadata** (impact 6, priority 6) — "Write a unique 25–65 char title, a 70–165 char description and one descriptive H1." Cause: excerpt was 170 chars, just over the 165 cap.
2. **SEO / internal_linking** (impact 6, priority 4.2) — "Add contextual links to and from 3+ relevant pages." Only 2 contextual outbound links present.
3. **GEO / answer_coverage** (impact 6, priority 1.44) — "Structure the page around the questions a reader/AI would ask." No query data available locally (expected — see Gaps below).

## Optimized version
Copied the post to `scratch/post-optimized.json` and applied 3 small, real edits (no source files touched):
1. Trimmed `excerpt` from 170 → 114 chars (into the 70–165 window) — targets the metadata recommendation.
2. Appended a body paragraph with two more contextual internal links (`/pricing`, `/how-it-works`) — targets internal_linking (2 → 4 internal links).
3. Appended a `{quote, cite}` block (wrapped in literal quotation marks, since the scorer's `countQuotes` proxy regex requires actual `"…"` characters) — targets the GEO evidence dimension. Also appended an `{faq: [...]}` block as a second, independent lever.

Re-scored: `node server/scripts/scoreBlogDraft.mjs scratch/post-optimized.json`

- `seo.score`: **89** (was 81, +8)
- `geo.score`: **92** (was 91, +1)
- `seo.profile`: `"blog"` ✅ (unchanged)

Per-dimension deltas that moved:
- `metadata`: 60 → 75 (excerpt now in-range)
- `internal_linking`: 50 → 100 (4 contextual internal links)
- GEO `evidence`: 75 → 90 (quote now detected: `signals.quotes` 0 → 1)

Remaining recommendation after optimization: only GEO `answer_coverage` (score unchanged at 60/0.6) — this is a genuine, documented ceiling, not a scorer bug: with no `queries`/GSC data passed (`scoreDraft` calls `scorePage(row, { queries: [], gsc: null, robots: {} })`), the dimension falls back to a structure-only heuristic (`headingCount >= 3 && wordCount >= 150 ? 0.6 : 0.35`) and cannot exceed 0.6 until real query/GSC data is wired in. Adding the FAQ block did not move this dimension — confirms it's query-data-gated, not content-gated, which matches the "honest ceiling (GSC dims)" note in the task-4 brief's self-review.

**Delta summary: SEO +8 (81→89), GEO +1 (91→92) — optimized ≥ baseline on both axes.** Confirms the scorer responds to real content changes and the skill's stated levers (metadata length, internal linking, evidence/quotes) are real, measurable levers.

## SKILL.md pipeline coherence check
`.claude/skills/blog-seo-optimizer/SKILL.md` documents the scoring step as:
```
node server/scripts/scoreBlogDraft.mjs <tmp>.json
```
This matches the actual CLI exactly (same script path, same single-JSON-file argument convention used above). The described pipeline order (parse MD → intent classification → SERP/content-gap → internal linking → citations → SEO/GEO/AEO optimization → score via this CLI → quality gate → PR) is coherent with what the CLI measures: metadata/content/internal-linking/structured-data on the SEO side, and crawler-access/extractability/entity-clarity/answer-coverage/structure/evidence/freshness on the GEO side — i.e. every lever the skill's earlier pipeline steps are meant to produce (links, citations, structure, entity/author, quotes) is exactly what this scorer measures. No full WebSearch/Supabase optimization loop was run (out of scope per task instructions); this check was a static read of SKILL.md plus the manual before/after re-score above, which stood in for a live pipeline run.

## Errors / gaps hit
- None blocking. `--selfcheck` and both scoring runs produced valid JSON on the first try, no module-resolution issues.
- Confirmed gap (by design, not a bug): GEO `answer_coverage` is capped at 0.6 without live query/GSC data — content edits alone cannot clear this recommendation locally. This matches the plan's own "Honest ceiling (GSC dims)" self-review note.
- `countQuotes` (evidence signal) requires literal `"…"`/`"…"` characters ≥20 chars long in body text — a `{quote: "text"}` block without literal quote-mark characters in the string is NOT auto-detected as a quote. Worth a one-line callout for anyone hand-authoring `quote` blocks.

## Confirmation
- No PR was opened, no branch pushed, no merge performed.
- No source files were modified — `client/src/data/blogPosts.js` untouched; all work happened under `scratch/` (post.json, post-optimized.json, baseline.json, optimized.json).
- The only file added to git by this validation is this note.
