---
name: ship-release
description: "Meeticulous end-of-day ship: merge the current release/YYYY-MM branch into main in ONE merge commit, wait for CI + Render + Vercel deploys, smoke-test prod, then clean up stale branches and worktrees. Use when the founder says /ship-release, 'ship the release', 'end of day merge', or 'run the cleanup of the day'."
trigger: /ship-release
---

# /ship-release — one merge to main, then clean up

Repo: `thekalamwala/meeticulous`. Invoking this command IS the founder's go-ahead to merge
the release into main (an exception to the CLAUDE.md "user merges" rule — only for this flow).

## Rules
- Day-to-day PRs target `release/YYYY-MM`, never `main`. This command is the only path to main.
- release → main is a **merge commit** (`gh pr merge --merge`), NEVER squash/rebase — squash makes
  release and main diverge and the next fast-forward impossible.
- Never force-push. Never delete `main` or the current `release/*`.
- Prod checks run on **meeticulous.com** (never .in — that root is cold-outreach mail, not the site).
- Narrate each step in one line so the founder can follow.
- Git Bash mangles refspecs: `export MSYS_NO_PATHCONV=1` before any command carrying `refs/heads/…`.

## 1. Preflight
```bash
git fetch -q --prune origin
REL=$(git branch -r --list 'origin/release/*' --format='%(refname:short)' | sort | tail -1 | sed 's#^origin/##')
git log --oneline origin/main..origin/$REL
```
- No commits → say "nothing to ship on $REL" and skip to step 6 (cleanup).
- Drift check: `git log --oneline origin/$REL..origin/main`. Non-empty (something merged straight
  to main) → sync first: a PR `main → $REL` merged with `--merge` (never squash), then continue.
  Shipping without it makes the release PR carry reverse diffs / conflicts.
- List open PRs still targeting `$REL` (`gh pr list --base $REL`) and mention them — they will
  NOT be in this ship. Don't wait on them.

## 2. Release PR
Reuse an open `$REL → main` PR if one exists, else:
```bash
gh pr create --base main --head $REL --title "release: $REL → main ($(date +%F))" --body "<list of PRs/commits from step 1>

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
If GitHub reports conflicts: stop and report — never resolve by force.

## 3. CI — including the two gates the release PR re-asks
Wait with one background `gh pr checks <n> --watch --interval 60`. Any failing check → stop,
report the failing check + log excerpt (`gh run view <id> --log-failed`), don't merge.
- "no checks reported" ~1 min after opening = GitHub dropped the pull_request event (seen
  2026-10-06). Re-fire it once: `gh pr close <n> && gh pr reopen <n>`, then watch again.
- "Server (unit tests): skipping" is normal when no server/ file changed (paths filter).
- Each check name can show SEVERAL rollup entries (one per run). GitHub evaluates the LATEST per
  name, so a stale `FAILURE` beside a fresh `SUCCESS` is not a block — read `mergeStateStatus`.

**The `signoff` gate is GONE (2026-11-27, PR #470; founder removed it).** No `Sign-off:` line or
`tax-signoff` label is needed. Instead, list any tax/TDS/TCS/GST/commission/payout lines in the
release PR body so the founder can see them. Required checks are now only Client + Server unit tests.

**`migrations` fires again on the release PR** even when the feature PR already cleared it: the
release PR carries the same diff (seen 2026-11-19).
- `migrations` wants the `migrations-applied` label, confirming every new `server/migrations/*`
  file in the ship is ALREADY applied to prod by hand. Verify it by querying the DB before
  labelling — its error cites v3.204_coupons, which shipped in code while the table was missing.
- Editing the body or adding a label re-fires the gate; no rerun needed.

## 4. Merge + keep the release branch
Auto-merge is **disabled org-wide** (`--auto` → "Auto merge is not allowed for this repository").
When requirements are already met `--auto` merges immediately, which looks like it worked but
isn't arming anything — so a PR cannot be left to land later. Merge when green.
"the head branch is not up to date with the base branch" = the ruleset's strict policy, not a
conflict: `gh pr update-branch <n>`, let CI re-run, then merge. Never `--admin`.
```bash
gh pr merge <n> --merge
git fetch -q origin
# Repo auto-deletes merged head branches, which includes $REL — put it back at the new main
# (fast-forward: release is an ancestor of the merge commit).
git push origin origin/main:refs/heads/$REL
```

## 5. Deploys + smoke test
- **Render API** (service `srv-dbhj4n8n74is73e5tahg`, `meeticulous-api`): only if the ship touches
  `server/` (`git diff --name-only <old-main>..<merge-sha> -- server/` non-empty) — Render's build
  filter skips client-only commits, so don't wait for a deploy that never comes. Poll until the
  deploy for the merge commit is `live`; `build_failed` / `update_failed` / `canceled` → report.
  The Render **MCP refuses to act without a workspace the user must pick**, so on an unattended
  ship use the API token instead (it is already in `server/.env`):
```bash
cd server && set -a && . ./.env && set +a
curl -s -H "Authorization: Bearer $RENDER_API_KEY" \
  "https://api.render.com/v1/services/srv-dbhj4n8n74is73e5tahg/deploys?limit=1"
```
- **Order matters: the website build must pre-render against a WARM API.** The merge triggers
  Render and the Vercel Action at the same minute. Vercel's postbuild pre-render calls the live
  API (`/api/appearance`, `/api/feature-flags`, `/api/host/:u`…), so while Render is restarting
  every call takes ~10s and the 30-min pre-render budget runs out. Seen 2026-11-26 (#457): 43
  routes left unbaked — every host profile, their service pages, `/team` — shipped as the bare
  5.6 KB SPA shell (crawlers see nothing). A redeploy with the API warm baked all 233 in 19 min.
  So: **when the ship touches `server/`, wait for Render `live` first; then judge Vercel's
  pre-render report below and redeploy once if it ran out of budget.**
- **Vercel** (GH Actions workflow "Deploy to Vercel (production)"). **The Action's `success` only
  means the remote build was QUEUED** (`vercel deploy --prod --no-wait`) — the site is unchanged
  until the Vercel deployment itself is `READY` (~20–35 min incl. pre-render; up to ~1h50 on slow
  days — not a hang before ~2h). Wait on the deployment, not the Action:
```bash
cd server && set -a && . ./.env && set +a
T=team_uxnH0xiRg1CUjgcNL1rxf0MJ; P=prj_G0HSyvMvRWt7doXpU7MRImSLgY5u
# newest production deployment: uid, readyState, commit (must be the merge sha)
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=$P&teamId=$T&target=production&limit=1"
# poll until readyState is READY (ERROR/CANCELED → report)
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" "https://api.vercel.com/v13/deployments/<uid>?teamId=$T"
```
  `failure` with "Unexpected error. Please try again later." is Vercel-side → `gh run rerun <id>`
  once. Test failures → report.
- **Pre-render report** — once READY, read the build log's summary line:
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v3/deployments/<uid>/events?teamId=$T&limit=-1&builds=1" \
  | grep -oE '\[prerender\] (Done in[^"]*|TIME BUDGET[^"]*)'
```
  Healthy: `… N rendered, 0 failed, 0 error-baked, 0 over budget`. **Any `over budget` > 0 or a
  `TIME BUDGET … hit` line → the API was still cold: confirm Render is `live`, then
  `gh run rerun <deploy-action-id>` ONCE and re-check.** Still over budget on a warm API = a real
  regression (slow page or endpoint) → report the unbaked routes, don't loop. (The budget is the
  `PRERENDER_BUDGET_MS` Vercel env var, 30 min — see memory `vercel-prerender-budget-cap`.)
- Smoke test (all must be 200; API body `"status":"ok"`) **and pages must be baked, not shells** —
  a 200 alone passed the 5.6 KB shells on 2026-11-26:
```bash
curl -s https://meeticulous-api.onrender.com/health      # commit must equal the merge sha
# One URL per page type, fetched AS GOOGLEBOT, with size + <title>. Pick real slugs from the
# sitemap (curl -s https://meeticulous-api.onrender.com/sitemap-hosts-1.xml) — products/courses
# belong to specific hosts (e.g. dsa-tracker is aastha-nikhare's, not sndatarkar's).
for p in / /pricing /team /sndatarkar /sndatarkar/seo-consultation \
         /sndatarkar/products /sndatarkar/courses /aastha-nikhare/membership \
         /sndatarkar/products/landing-page-pack /sndatarkar/courses/booked-out-60-days; do
  f=$(mktemp); curl -s -A "Googlebot/2.1 (+http://www.google.com/bot.html)" "https://meeticulous.com$p" -o $f \
    -w "%{http_code} %{size_download}B $p | "; grep -o '<title>[^<]*' $f | head -1 | cut -c8-80; rm -f $f; done
# Old URLs must 301 in ONE hop to the /products|/courses slug URL:
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://meeticulous.com/aastha-nikhare/product/demo-dsa-tracker
```
  Every page must be well over 10 KB (baked pages are ~100–360 KB; ~5.6 KB = bare shell) AND carry a
  page-specific `<title>` — the generic "Meeticulous — the calm way to sell your time" means a shell.
  Also read the pre-render line: route count should not DROP vs the last ship (252 on 2026-11-27).
  Optional score gate: `cd server && node --env-file=.env scripts/scorePageUrl.mjs <url> --type product`
  (profile/service/tabs/product/course/membership target SEO ≥ 90, GEO ≥ 90).
  `/community` is NOT on the pre-render list (renders on demand), so its ~5.6 KB is expected —
  check it for 200 only.
The health body also reports `uptime` — a small value confirms the API actually restarted on the
new code, rather than the old process still answering. Check it, not just the 200.

## 6. Cleanup
Remote — branches whose PR is merged/closed (auto-delete normally handles merged ones):
```bash
for b in $(git branch -r --format='%(refname:short)' | grep -v HEAD | sed 's#^origin/##' | grep -vE '^(main|release/)'); do
  s=$(gh pr list --state all --head "$b" --limit 1 --json state -q '.[0].state'); echo "$b ${s:-NO-PR}"; done
```
**A `MERGED` PR does not mean the branch holds nothing.** Commits pushed AFTER the merge are still
on it and reach no release. On 2026-11-19 `perf/load-health-p0` was MERGED and carried 2 such
commits (an edge-cache doc, an `invoiceUrl` fix) — deleting on the label alone would have lost
them. So count first, whatever the PR state says:
```bash
git log --oneline origin/main..origin/<b> | wc -l
```
- **0 unique commits** → safe to delete (`git push origin --delete <b>`), MERGED or CLOSED.
- **Any unique commits** → KEEP and list for the founder with the commit subjects, whatever the
  PR state. Deleting is theirs to decide.
- `OPEN` or `NO-PR` → keep and list them (no PR = possibly unmerged work nobody is tracking).

Local (main checkout):
```bash
git fetch -q --prune origin
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -D   # upstream deleted = merged
git worktree prune
git branch -f $REL origin/$REL 2>/dev/null; git branch -f main origin/main 2>/dev/null   # skips a checked-out branch
```
Never delete a branch checked out in a worktree, or a local-only branch with commits not on
origin — list those instead.

## 7. Report
One table: commits shipped (PR numbers), CI, Render, Vercel (deployment READY + pre-render
`rendered / over budget`, and whether a warm-API redeploy was needed), smoke test (codes + sizes),
branches deleted / kept (with why), and anything that needs the founder.
