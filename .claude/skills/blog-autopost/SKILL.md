---
name: blog-autopost
description: Unattended daily blog publisher for Meeticulous. Orchestrates the full pipeline around blog-seo-optimizer — selects the next draft, runs the optimizer, and ONLY if the quality gate passes, auto-merges the blog-only PR and seeds both DBs so the post goes live. Two modes — marketing (drain a drafts folder) and recap (build-in-public post from merged PRs). Designed to be run headless via `claude -p "/blog-autopost <mode>"` from Windows Task Scheduler. Trigger: "/blog-autopost", "autopost the blog", "run the daily blog job".
---

# Blog Autopost (Meeticulous) — unattended publisher

Wraps [blog-seo-optimizer](../blog-seo-optimizer/SKILL.md). That skill stops at the PR by design;
THIS skill is the only thing allowed to merge + publish, and only behind the gate below.

**Runs unattended against PROD.** The quality gate is the sole reviewer. Never widen what
auto-merges beyond a blog-only diff. If anything is ambiguous, STOP and leave the PR open.

## Modes
`/blog-autopost marketing` — publish the next unposted draft from the drafts folder.
`/blog-autopost recap` — publish a "what we shipped" post built from recently merged PRs.

Drafts folder (marketing): `D:\My Marketing\Meeticulous\Blog` (Windows) /
`/d/My Marketing/Meeticulous/Blog` (Git-Bash). Archive subfolder: `.../Blog/_posted`.

## Preconditions (abort the run if any fail)
- Runs in the DEDICATED worktree set up by `scripts/blog-autopost.ps1` (isolated from any
  interactive/peer session sharing the primary checkout — a shared checkout caused a
  wrong-branch commit during the build). Never run this in the primary OneDrive checkout.
- Clean git tree. On the `autopost-runner` branch reset to `origin/main` (never run on `main`).
- A single-run lock: if `scratch/.blog-autopost.lock` exists and is <6h old, exit (another run).
  Else write it (with timestamp) and remove it at the end.
- `gh auth status` OK; `server/.env` and `server/.env.staging` present (seed needs them).

## Marketing pipeline
1. **Select.** List `*.md` in the drafts folder (ignore `_posted/`). Parse each front-matter
   `slug` (or derive from filename). Skip any slug already present in
   `client/src/data/blogPosts.js` OR already in `_posted/`. Take the OLDEST remaining by mtime.
   None left → log "no drafts" and exit 0.
2. **Optimize.** Invoke `blog-seo-optimizer` on that file. Let it run its full pipeline
   (parse → cannibalization → SERP → links → optimize → verify → score → gate) and open its PR.
   Capture its final decision (`READY FOR PR` / `NEEDS WORK`) and the PR URL.
   NOTE: drafts in the queue cross-link each other; the optimizer delinks any `/blog/<slug>`
   target not yet published (step 5) so a forward-link to an unposted sibling never fails the
   gate. This is why the daily run doesn't stall on the first interlinked post.
3. **Gate.** If `NEEDS WORK` → do NOT merge. Leave PR open, log the reason, move the draft to
   `_posted/` ONLY on success (not here — leave it so a human can retry). Exit 0.
4. **Verify scope (hard safety).** `gh pr diff <pr> --name-only` MUST be a SUBSET of exactly two
   paths — `client/src/data/blogPosts.js` and `client/src/data/blogClusters.js` (the post + its
   link-graph taxonomy). Any other path → abort merge, log, exit 1.
5. **Merge.** `gh pr checks <pr>` must be green/neutral (no failure). Then
   `gh pr merge <pr> --squash --delete-branch`.
6. **Publish (seed BOTH DBs).** Sync to the merged main WITHOUT checking out `main`
   (the runner is in a dedicated worktree; `main` is held by the primary checkout):
   `git fetch origin && git reset --hard origin/main`. Then:
   ```
   cd server
   node -r dotenv/config scripts/seedBlogs.js dotenv_config_path=.env           # prod  Mumbai
   node -r dotenv/config scripts/seedBlogs.js dotenv_config_path=.env.staging   # staging Tokyo
   ```
   Both must print the new slug as `ok`. A seed failure = NOT published → log LOUD, exit 1
   (post source is merged but not live; a human must re-seed).
7. **Archive.** Move the source draft into `_posted/` so it is never re-selected.
8. **Log.** Append one line to `scratch/blog-autopost.log`: date, mode, slug, PR, seed result.

## Recap pipeline
1. **Gather.** `gh pr list --state merged --base main --search "merged:>=<YYYY-MM-DD>"` for the
   last 2 days (this repo). Read titles + bodies. If 0 merged PRs → log + exit 0 (nothing to recap).
2. **Draft.** Write a short build-in-public post (MD, same front-matter shape blog-seo-optimizer
   expects: title/slug/category/date/author/excerpt). Category MUST be a `CATEGORY_THEME` key;
   author = the exported `AUTHOR`. Slug like `weekly-build-recap-<YYYY-MM-DD>`. Keep it honest —
   summarize shipped user-facing changes only; skip internal chores/infra unless notable.
   Write it to `scratch/recap-<date>.md`.
3. Then run steps 2–8 of the marketing pipeline on that file (optimize → gate → scope → merge →
   seed both DBs → log). Recap posts have no `_posted/` folder; the log line is the record.

## Hard rules (unattended safety)
- **Only ever merge a diff limited to `client/src/data/blogPosts.js` + `client/src/data/blogClusters.js`.**
  Re-check with `--name-only` right before merge; abort on any other path.
- **Never merge on a failing quality gate or failing CI.**
- **Never fabricate URLs/claims** — inherited from blog-seo-optimizer.
- **Seed failure ≠ success.** A merged-but-unseeded post is INVISIBLE; treat as failure and shout.
- One post per mode per run. No loops, no catch-up backfills.
- Recap summarizes only what actually merged — no roadmap/speculation.
