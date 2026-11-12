# Project Audit Guide

The standard procedure for a **comprehensive audit, full-codebase review, major cleanup or any
large-scale maintenance task**. Read it fully before starting one. It is written to be reusable:
sections 1–10 are project-agnostic; section 11 holds the few facts specific to this repository.

The goal of an audit is a codebase that is more correct and easier to maintain, **with no change in
behaviour the owner did not approve**. Finding problems is cheap; the discipline is in verifying
them, fixing only what is provably safe, and handing the rest over as clear decisions.

---

## 1. Ground rules

1. **Preserve behaviour.** Business logic, UX, integrations, API shapes, routes, DB columns and
   persisted keys stay as they are unless the owner approves a change.
2. **Evidence or it is not a finding.** Every finding cites `path:line` (or a query result) and has
   been confirmed by reading the code path end to end. "Looks suspicious" is a lead, not a finding.
3. **Fix only what is clear.** If the right fix needs a product, architecture or data decision, it
   goes on the review list (section 7) and is not touched.
4. **No rewrites.** Do not restructure, rename or "modernise" working code. The smallest diff that
   removes the defect wins. Refactoring is in scope only when it removes a demonstrated problem.
5. **Nothing silent.** Every change appears in the final report. Every skipped area is named.
6. **Read-only outside the repo.** Live databases, third-party dashboards and production services
   are inspected read-only, and only with the owner's permission. Never run migrations, seed
   scripts, senders or a local server against live data as part of an audit.

## 2. Phase 0 — Setup (before reading any code)

- **Ask the scoping questions first:** depth (parallel reviewers vs single pass), whether live-DB
  read-only checks are allowed, how to treat dependencies (flag only / remove unused / upgrade),
  and any areas that are off limits.
- **Isolate the work.** New branch from the latest integration branch (the open release branch if
  one is ahead of `main`), in its own git worktree if other sessions share the checkout. Never
  audit on someone else's dirty working tree.
- **Record the baseline before changing anything.** Run the full test suites and the production
  build on the untouched branch and save the results. Pre-existing failures are findings in their
  own right, and without a baseline you cannot tell a regression from an old failure.
- **Read the project's own orientation docs** (README, CLAUDE.md, architecture / feature map /
  critical-files docs). Note every rule and every "intentional, do not change" statement — those
  become the exclusion list handed to reviewers.

## 3. Phase 1 — Map the project

Build a factual map before judging anything:

| Question | How |
|---|---|
| What is tracked, and how big is each area? | `git ls-files \| awk -F/ '{print $1"/"$2}' \| sort \| uniq -c \| sort -rn` |
| Entry points | server bootstrap file, client entry + router, cron/worker registration, build scripts |
| How it ships | CI workflows, deploy config, hooks, env files and examples |
| Trust boundaries | every public route, webhook, upload, auth door, admin door, DB access role |
| Money / irreversible paths | payments, payouts, refunds, subscriptions, outbound email/SMS/WhatsApp |
| Data layer | migrations folder(s), what is actually applied, RLS/grants model |
| Recent churn | `git log --since=<date> --stat` — recently changed code is where bugs cluster |

Split the repository into **independent audit areas** from this map. A good default split:
auth & security surface · money paths · services / jobs / integrations · server dead code ·
client core flows · client dead code & design-system drift · config / CI / dependencies / docs ·
database (live, read-only).

## 4. Phase 2 — Inspect

- **One reviewer per area, in parallel**, each with a self-contained brief: scope, what the product
  must guarantee, the exclusion list of intentional patterns, the output format, and an explicit
  read-only instruction. Reviewers report; they do not edit.
- **Triage, then read deeply.** No one can deep-read thousands of files. Grep for risk patterns
  across the area, then read the suspicious sites and their callers completely.
- **The lead verifies every reported finding** before it is fixed or reported: open the file, read
  the callers, confirm the scenario. Reviewer output is a list of leads with a confidence level,
  not ground truth. Discard what does not survive.
- **"Unused" needs proof of absence.** Build the import/require graph properly (extension
  inference, index files, aliases, lazy/dynamic imports, glob loaders, CSS imports), then confirm
  with a repo-wide search that also covers scripts, CI workflows, deploy config, docs runbooks,
  other packages, and runtime-built paths (`/og/${slug}.png`). A file referenced only by its own
  test is dead code plus a dead test.

## 5. Checklists

Use these as prompts, not as boxes to tick. Report only real, verified defects.

### Backend / API
- Every route has the correct guard (auth, role/permission, plan gate); no IDOR (ids from the
  request checked against the caller); no mass assignment of request bodies into writes.
- Input validated at trust boundaries; consistent error shape; no stack traces or secrets in
  responses or logs.
- No duplicate or shadowed endpoints; no unmounted routers; no controller exports without a route.
- Unawaited promises, swallowed errors where failure matters, `await` in loops that should batch.
- Background jobs: locked against overlap, idempotent, bounded retries, safe on restart.
- Outbound messaging always passes the consent / suppression / rate gates.

### Money and other irreversible paths
- Amounts never come from the client; prices are snapshotted, not recomputed.
- Provider signatures verified; webhooks idempotent and replay-safe.
- Check-then-write races closed by a constraint or lock, not by hope.
- Rounding and currency-unit conversion in one place; limits and prices from configuration/DB.

### Database
- Migrations folder vs what is actually applied (drift in either direction).
- Access model: RLS on every table, **and what each policy and grant really allows** — a table
  the app only touches through a privileged server role must not also be writable by end-user
  roles through an old policy. Check policies, table/column grants, `SECURITY DEFINER` functions,
  view security mode, storage bucket visibility.
- Platform advisors (security + performance): unindexed foreign keys on hot tables, per-row auth
  function calls in policies, duplicate policies, unused indexes.
- Query patterns in code: N+1, `select *` on wide tables in hot paths, unbounded reads that
  silently truncate at the platform's row cap.

### Frontend
- Routing: every route resolves to an existing component; every internal link has a route; guards
  cannot be bypassed and do not flash protected content.
- Effects: cleanup, stale closures that cause real bugs, response races, state set after unmount.
- Session handling: refresh races, complete logout, one way of calling the API.
- Injection: every raw-HTML sink and JSON-LD builder, `target="_blank"` rel, redirect parameters.
- Performance: route-level code splitting, eager heavy imports, repeated fetches, image handling.
- Design system: hard-coded colours/fonts/radii, legacy classes, duplicated components.

### Security (cross-cutting)
- Committed secrets (report the type and location, never the value); `.gitignore` coverage.
- Secret comparison timing, token lifetime and revocation, insecure fallbacks for missing env.
- File uploads (type sniffing, size, path), SSRF in fetchers, open redirects, CORS, rate limits.
- Anything public-key-reachable in the data layer (see Database).

### Performance
- Hot request paths: query count, payload size, caching and cache invalidation.
- Bundle: largest chunks, duplicate libraries, assets shipped but unused.
- Jobs: work proportional to table size on every tick.

### Testing
- Baseline failures and their cause (stale mock vs real bug).
- Skipped / todo / empty tests; tests for deleted modules; tests asserting implementation details
  of code that has since changed.
- High-risk paths with no test at all (list them; do not write a test suite unasked).

### Dependencies
- Unused packages, packages imported but undeclared, wrong section (runtime vs dev).
- Two libraries doing one job. Deprecated or end-of-life majors (informational).
- Runtime version consistency across package files, CI and hosting config.

### Architecture, config and docs
- Inconsistent patterns for the same job (several validators, formatters, API clients).
- CI: jobs that cannot run, missing branch coverage, unpinned or deprecated actions, leaked
  secrets in logs, over-broad permissions.
- Env vars read by code vs documented in examples (both directions).
- Docs that contradict the code or each other; references to files that no longer exist.
- Repo clutter: generated output, backups, large binaries, obsolete top-level folders.

## 6. Safe fix or needs approval?

A change is a **safe fix** only if every line below is true. Otherwise it is **needs approval**.

| Test | Safe fix | Needs approval |
|---|---|---|
| Correct outcome | Unambiguous — one right answer | Depends on intent or preference |
| Behaviour | Unchanged for every legitimate user | Any user-visible or API-visible change |
| Blast radius | Local; all callers read and unaffected | Shared helper, schema, auth, money, messaging |
| Reversibility | Plain revert | Data, schema, config or external state changes |
| Verification | Proven by an existing or added test / build | Cannot be verified from this environment |
| Deletion | Proven unreferenced everywhere | Possibly used by a script, runbook or person |

Always **needs approval**, however obvious it looks: schema or data changes and anything applied to
a live database; auth, permissions, payments, pricing, payouts, subscriptions; outbound messaging
rules; dependency upgrades and lockfile changes; renaming routes, columns, env vars or persisted
storage keys; removing features, flags, scripts or docs that someone may still rely on; anything
touching deploy/CI behaviour.

## 7. The review list (for everything not fixed)

One entry per issue, grouped **Critical → High → Medium → Low**:

- **What & where** — one sentence, with `path:line` or the query that shows it.
- **Why it is a problem** — the concrete failure or exploit scenario.
- **Impact** — who is affected, how badly, how likely, and whether it is live today.
- **Recommended fix** — specific enough to implement.
- **Risks / dependencies** — what could break, what must happen first, what it costs.

Priority definitions:
- **Critical** — security breach, money loss or data loss possible now. Fix before anything else.
- **High** — real bug or exposure on a main path, or a fix that unblocks launch-critical work.
- **Medium** — correctness or maintainability problem with limited reach or a workaround.
- **Low** — cleanup, consistency, informational.

Nothing on this list is implemented until the owner approves it.

## 8. Fixing safely

- Fix at the root cause, in the one place all callers route through; read every caller first.
- One concern per commit, with a message that says what and why. Mechanical cleanup and behaviour
  fixes never share a commit.
- Deleting code: state the proof of non-use in the commit message. Delete the dead test with it.
- Keep comments that explain business logic. Keep defensive fallbacks unless proven obsolete.
- Do not touch files with unrelated uncommitted work, lockfiles, or generated files.
- When a "fix" starts to need a second and third change to make things pass, stop — it was not a
  safe fix. Revert it and move it to the review list.

## 9. Verify

- Re-run the **same** suites and build as the baseline. Required result: no new failures, and any
  baseline failure either fixed or reported unchanged.
- For each fix, name the check that proves it (test name, build, grep showing zero references).
- A change that cannot be exercised from this environment (needs a browser session, live
  credentials, a deploy) is reported as **not verified**, never as done.
- Never weaken, skip or delete a test to get a green run. A test that was wrong is fixed with an
  explanation.

## 10. Report

The final report always contains, in this order:

1. **What was audited** — areas, method, and what was *not* covered.
2. **Issues identified** — counts by severity and area, with the notable ones spelled out.
3. **Fixes implemented** — each with the reason and the proof.
4. **Files created / modified / removed.**
5. **Test and build results** — baseline vs after, with numbers.
6. **Review list** — section 7 format, prioritised, awaiting approval.
7. **Follow-ups** — pending migrations, stale docs, anything time-sensitive.

Deliver the fixes as a pull request against the integration branch and stop there. Update the
project's status docs only for facts that changed and were verified during the audit.

## 11. This repository

Kept short on purpose — the detail lives in `CLAUDE.md` and `docs/`.

- **Orientation:** `docs/ai-context.md`, `docs/feature-map.md`, `docs/critical-files.md`,
  `docs/current-state.md`, `docs/current-work.md`. Design rules: `design-system/BRAND_RULES.md`.
- **Layout:** `server/` (Express API, Jest), `client/` (React + Vite SPA, Vitest),
  `server/migrations/` (SQL, applied by hand), `design-system/`, `docs/`.
- **Branching:** work on a fresh branch in its own worktree; PR base is the open
  `release/YYYY-MM` branch; never merge — the owner merges.
- **Baseline commands:** `cd server && npm test` · `cd client && npm test` ·
  `cd client && npm run build`.
- **Intentional patterns — do not "fix":** schema-fallback retries on missing columns; feature
  flags that fail closed; legacy plan slugs and persisted storage keys (`bas_admin`); duplicate
  migration version numbers; the two-layer `/blogs` redirect; provider order in `App.jsx`.
- **Live database:** one Supabase project. Read-only checks need the owner's yes. Never boot the
  server locally against it (customer-facing crons run on boot) and never run the email-template
  seed script (it overwrites every template).
- **Server-only data access:** the browser uses Supabase for sign-in and realtime only; all table
  access goes through the API with the service role. Audit RLS policies and grants against that
  assumption — any policy that lets `anon` / `authenticated` write a table is suspect.
- **Worktree caveat:** if `node_modules` is linked into a worktree by junction, remove the
  junction by hand before deleting the worktree, and never run `git clean` there.
