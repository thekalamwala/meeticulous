# Contributing to Meeticulous

A small, trusted team shipping fast with Claude Code. Keep it simple — **`main` is production.**

## The loop

1. **Branch off the latest `main`**
   `git fetch origin && git switch -c <type>/<slug> origin/main`
   Types: `feat/`, `fix/`, `chore/`, `docs/`. One task per branch; keep it short-lived (merge within a day or two).
2. **Commit** in [Conventional Commits](https://www.conventionalcommits.org) style — `feat(booking): …`, `fix(auth): …`.
3. **Open a PR into the open release train**, not `main` — find it with `git branch -r | grep release/`,
   then `gh pr create --base release/YYYY-MM`. CI runs automatically (server + client unit tests).
   Only a hotfix the founder asks for targets `main` directly.
4. **One teammate reviews**, then **squash-merge** into the release train. Delete the branch after.
5. **The release train ships to `main` in one merge** (`/ship-release`), and **merging `main` ships to
   production** (see Deploy). Whoever merges watches the deploy and smoke-tests prod.

If your branch goes stale, rebase before opening the PR: `git fetch && git rebase origin/main`. Resolve conflicts on your branch, never on `main`.

## Review & merge

- **Every change goes through a PR** — don't push to `main` directly.
- **One approving review + green CI** before merge. CI (`.github/workflows/ci.yml`) runs the server and client unit suites; a suite that doesn't apply to your change auto-skips (a skipped check counts as passing).
- **Squash-merge** — one clean commit per PR on `main`.
- ⚠️ **Enforcement note:** `main` is protected *by convention*. GitHub branch protection (forced reviews / blocked direct pushes / required checks / auto-merge) needs **GitHub Pro** on this private repo. Until then the rules above are a team agreement — the real backstop is the deploy gate below, which refuses to ship broken code.

## Deploy — merge = prod

- **Client → Vercel.** On a push to `main` touching `client/**`, `.github/workflows/deploy-vercel.yml` runs `vercel deploy --prod` — a **remote build** (`vitest → vite build → prerender`). Any test/build failure **fails the deploy**, so broken client code can't reach prod. Requires the **`VERCEL_TOKEN`** repo secret (GitHub → Settings → Secrets and variables → Actions).
- **Server → Render.** Render auto-deploys `main`; its build runs `npm run test:unit`, so a failing server test blocks the server release.
- **DB / env changes ship WITH the deploy.** If a PR needs a `subscription_plans` change, a new env var, or a migration, call it out in the PR and apply it at merge time — display and data must flip together (lesson from the plan reprice).
- **Smoke test (automated).** `.github/workflows/smoke.yml` fires on Vercel's `deployment_status` and loads a few public routes in a real headless browser, failing on a white screen, a severe console error, or the CSS-cascade class of bug (a transparent `.cta-press` / 0px `.btn--outline` — what unit tests miss). It runs on **every PR's Vercel preview** (a pre-merge signal) and on the **production deploy** (post-ship canary). Run it by hand before shipping too: `cd client && npm run smoke -- https://<preview-or-prod-url>`.
- **Hotfix:** same loop, just urgent — branch off `main`, PR, merge, deploy.

## Working with Claude Code

- **One git worktree per session** so 4 people + their agents don't collide. **One writer per set of files** at a time.
- Claude **stops at the PR**; a human reviews and merges — keeps a person between the code and prod.
- Before finishing a change: `cd server && npm test` and `cd client && npm run build`. Only flag failures your change actually caused.
- **Install the pre-push gate (once per clone):** `git config core.hooksPath .githooks` — or run `sh scripts/setup-hooks.sh`. It runs the *exact* CI suite (server jest / client vitest, only the half you touched) locally before every push, so a red test can't reach GitHub. Emergency bypass: `git push --no-verify`.

## Want hard enforcement later?

Upgrade this repo's owner to **GitHub Pro** (~$4/mo), then you can lock `main`: require a PR + 1 approval + green CI, block direct pushes, and enable auto-merge-on-green. The workflow above doesn't change — it just becomes enforced instead of trusted.
