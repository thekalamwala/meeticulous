# September 2026 Release Train

**Window:** Wed 23 Sep → Sun 27 Sep 2026 · **Code freeze:** Sun 27 Sep 18:00 IST · **Ship:** Sun 27 Sep 21:30 IST
**Train branch:** `release/2026-09` · **Train PR:** `release/2026-09 → main` (draft until ship night)
**Owner of the merge button:** the founder. Claude never merges to `main`.

Every PR opened in the window lands in this train, and the train lands on `main` **once**:
one Vercel deploy, one Render deploy, one set of checks on ship night, instead of a deploy per PR.

---

## 1. How the train works

```
feat/a ──PR──┐
fix/b  ──PR──┼──▶ release/2026-09 ──(one merge on Sun night)──▶ main ──▶ Vercel + Render
docs/c ──PR──┘         ▲
                       └── `git merge origin/main` after any hotfix (keep it current)
```

- Feature PRs **target `release/2026-09`**, not `main`. Merging into the train deploys nothing,
  so a PR can be merged into the train as soon as it's reviewed. Conflicts then show up one PR at a time
  during the week, not all at once on Sunday.
- The train PR (`release/2026-09 → main`) runs CI on every push to the train (server Jest + client vitest).
  PRs *into* the train also get CI (`release/**` is added to the `pull_request` trigger in `ci.yml`).
- Ship night merges the train with **"Create a merge commit"** (not squash). It's still one push to `main`, so
  still one deploy, and each feature keeps its own commit, so one bad feature can be reverted without
  pulling the whole release.

## 2. Rules for every PR in the window

1. **Branch from the train, target the train.**
   ```bash
   git fetch origin && git switch -c <type>/<slug> origin/release/2026-09
   gh pr create --base release/2026-09 ...
   ```
2. **Add a row to the manifest (§3) in the same PR.** No row means it doesn't ship. Merge conflicts on the manifest table
   are expected and trivial: keep both rows.
3. **Migrations: claim the number in the manifest first.** Next free number is **`v3.169`** (v3.165–v3.168 verified
   live on both DBs on 2026-09-23). Parallel sessions have collided on numbers before (the two `v3.130` files).
   The manifest row is the lock: first to claim it gets the number.
4. **Additive migrations only.** Add columns and tables. No drops or renames, and no NOT NULL on existing rows. Keep the code-side
   schema fallback (degrade gracefully if the column or table is missing), so prod migrations can be applied
   *before* the deploy with zero risk. Anything destructive waits for October.
5. **Apply each migration to staging (Tokyo `STAGING_PROJECT_REF`) when its PR merges into the train.**
   Prod (Mumbai `PROD_PROJECT_REF`) waits for ship night (§5).
6. **Before asking for merge, run locally:** `cd server && npm test` and `cd client && npx vitest run && npm run build`.
   A single stale client test blocks **all** Vercel deploys, and CI green does not guarantee the Vercel build passes.
7. **PR body must state:** migration (file + number or "none"), new env vars (Render/Vercel), post-deploy steps
   (reseeds, seedBlogs, flag flips), and how to verify it live.
8. **Nothing merges to `main` directly** except a prod-down hotfix (§4).

## 3. Manifest — what ships

| # | PR | Area | Migration | Env vars | Post-deploy step | Verify live | In train |
|---|----|------|-----------|----------|------------------|-------------|----------|
| 0 | this PR | release plan + CI trigger | none | none | none | n/a | ✅ |

*(Add one row per PR. "In train" = merged into `release/2026-09`.)*

## 4. Hotfix rule (prod-down only)

Only for something **broken in prod right now**: payments, bookings, login, site or API down, data exposure.
Everything else waits for the train.

1. Branch from `main`, PR to `main`, founder merges → it deploys alone.
2. Immediately bring the train up to date so it can't reintroduce the bug:
   ```bash
   git switch release/2026-09 && git pull && git merge origin/main && git push
   ```
   Use merge, **never rebase** the train (open feature branches are built on it).

## 5. Timeline

| When (IST) | What |
|------------|------|
| **Wed 23** | Train branch + draft train PR open. Work starts; PRs target the train. |
| **Wed–Sat, each evening** | Train health check: train PR CI green? `git merge origin/main` if `main` moved. Manifest complete for everything merged? |
| **Sat 26, evening** | **Soft cut.** Anything big or risky that isn't in the train by now goes to the October train. Sunday is for small PRs and fixes only. |
| **Sun 27, 18:00** | **Code freeze.** Nothing else merges into the train. Open PRs get retargeted to the next train. |
| **Sun 27, 18:00–20:30** | Pre-flight (§6). |
| **Sun 27, 21:00** | Go / no-go. Everything in §6 green → go. Anything red → pull that PR from the train (revert its merge on the train) or slip the release to Mon morning. |
| **Sun 27, 21:30** | Ship (§7). After 20:00 the CRM quiet-hours window means no customer sends are in flight during the Render restart. |
| **Sun 27, ~22:15** | Verify (§8), tag, close out (§10). |

## 6. Pre-flight (Sun 18:00–20:30)

- [ ] Train PR CI green (server + client jobs) on the **final** commit.
- [ ] Locally on the train head: `server: npm test` · `client: npx vitest run && npm run build`.
- [ ] Every merged PR has a complete manifest row; every migration in the manifest is **applied on staging**.
- [ ] Anything touching `client/index.html` `%VITE_*%` placeholders → the placeholder is also set in the
      `Build (no prerender)` env of **both** `deploy-vercel.yml` and `host-og-cards.yml` (else the Vercel deploy skips silently).
- [ ] Any new top-level route → added to `reservedSegments` (+ `reservedNamespaces`) or it gets eaten by the host-slug route.
- [ ] Any new lucide icon import on `/for/*` pages → exists in the installed lucide version (a missing icon breaks every `/for` page).
- [ ] GitHub Actions has minutes/billing headroom (`gh run list -L 3` shows runs starting, not `startup_failure`).
      Actions is the **only** Vercel deployer.
- [ ] New env vars from the manifest are **set in Render / Vercel now** (before the merge, since the new code reads them at boot).
- [ ] Prod backup: confirm the latest `backup.yml` run succeeded, or run it (`gh workflow run backup.yml`).

## 7. Ship (Sun 21:30)

Order matters. The database goes first, then code.

1. **Prod migrations**, in manifest order, on Mumbai `PROD_PROJECT_REF`. After each one, run its verification query.
   (Safe before deploy because every migration is additive and schema-fallback-guarded, per rule 4.)
2. Mark the train PR ready → **founder merges with "Create a merge commit".**
3. Watch both deploys:
   - Vercel: `gh run list --workflow "Deploy to Vercel (production)" -L 1`, then check that the **`deploy` job succeeded**
     on the merge SHA. A skipped job is a failure. On a prerender `HTTP 403` (transient rate limit), re-run:
     `gh workflow run deploy-vercel.yml --ref main`.
   - Render: `curl https://meeticulous-api.onrender.com/health`. Once the `uptime` resets past the merge time, the new server is live.
4. Run each manifest row's post-deploy step (Bolt KB reseed, `seedBlogs` on both DBs, flag flips).

## 8. Verify (on **meeticulous.com**, never .in)

- [ ] Home, `/pricing`, one host profile, one service page load with no console errors.
- [ ] Host Google login → dashboard loads.
- [ ] Guest WhatsApp OTP login → `/user` loads.
- [ ] One booking reaches the Razorpay checkout (don't need to pay).
- [ ] Each manifest row's "Verify live" check.
- [ ] Tag the release: `node scripts/release.mjs v2026.9.0` (tag = one-command rollback reference; the script only
      accepts `vX.Y.Z`, so hotfixes after the release become `v2026.9.1`, `v2026.9.2`, and so on).

## 9. Rollback

| Broke | Undo | Speed |
|-------|------|-------|
| One feature | `git revert -m 1 <that PR's merge commit on the train>` → PR to `main` (the merge-commit ship keeps each feature revertable) | minutes |
| Whole frontend | Vercel → Deployments → previous → Promote to Production | seconds |
| Whole backend | Render → meeticulous-api → Events → previous deploy → Rollback | ~1 min |
| Database | No undo. Migrations are additive, so old code runs fine against the new schema: roll the **code** back and leave the DB alone. | n/a |

## 10. Close-out (after verify)

- [ ] Update `CLAUDE.md` → "Database Migrations — Status" with every migration this release applied on both DBs.
- [ ] `docs/current-work.md`: one line per shipped feature.
- [ ] Retarget any still-open PRs on the train to `main` (or to the next train) **before** deleting the branch.
      Deleting a branch closes every PR still based on it.
- [ ] Delete `release/2026-09` (local + remote).
