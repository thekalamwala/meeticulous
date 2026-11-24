# Vercel build tuning & Actions-minute budget

How the client ships, what it costs, and the knobs that keep the build under
Vercel's 45-minute hard cap without burning GitHub Actions minutes.

> Context: the client builds **remotely on Vercel** (`vercel-build` = vite build +
> prerender of ~300 routes). Server is separate (Render). See the deploy pipeline
> in `.github/workflows/deploy-vercel.yml` and the prerender in
> `client/scripts/prerender.mjs`.

## The cost shape

- **Vercel build minutes** — one prod build = `vite build` + Puppeteer prerender of
  **~300 routes** (≈140 static + ≈98 blog + ≈65 host/service), each a
  `networkidle0` render against the **cold free-tier Render API**. Builds run
  **11–32 min**; variance is almost entirely cold-API latency, not code. Vercel
  **kills any build at 45 min and ships nothing**, so the ceiling is the real risk.
- **GitHub Actions minutes** — the deploy workflow is a thin wrapper around
  `vercel deploy`; the build runs on Vercel. CI (`ci.yml`) runs unit tests only.
- **Vercel usage quotas** (data transfer, function invocations, storage) — not a
  constraint at current scale; watch, don't tune.

## Knobs

All are environment variables on the Vercel project
(**Settings → Environment Variables**, scope **Production** — prerender is skipped
on Preview builds). An env change needs a **redeploy** to take effect.

| Var | Default | Purpose |
|---|---|---|
| `PRERENDER_POOL` | `4` | Parallel Puppeteer renders. Most of a route's wall clock is `networkidle0` I/O wait, so **6–8 wide can cut the build ~30–40%**. Clamped `[1,16]`. Higher values can saturate the ~4-vCPU builder and re-trigger the straggler timeout jam — raise gradually, watch one deploy. |
| `PRERENDER_HOST_CAP` | `1500` | Max host/service routes prerendered, to bound the build as the catalog grows. **No-op today** (~15 host/service routes). Profession pages (`/services/:slug`) are always kept; capped routes serve the SPA fallback. |
| `PRERENDER_BUDGET_MS` | `1800000` (30 min) | Wall-clock prerender budget. The safety net: past it, unrendered routes serve the SPA fallback instead of Vercel killing the build at 45 min. Leave as-is. |

## Rollout: raising `PRERENDER_POOL`

1. Set `PRERENDER_POOL=6` (Production), redeploy (Deployments → Redeploy latest
   `main`, or push a commit).
2. Read the build log's last prerender line:
   ```
   [prerender] Done in N min: X rendered, 0 failed, 0 error-baked, 0 over budget
   ```
3. **Good** = `failed 0` **and** `over budget 0` **and** `N` lower than baseline →
   keep `6`, try `8` next cycle.
4. **Bad** = any `failed` / `over budget`, or many `defer <route>` lines → the
   builder is saturated. Drop to `5`, redeploy. No code change needed.
5. Hard floor: `4` (the pre-tuning default).

## Revert

- Any knob: delete the env var (or set back to its default) and redeploy. All are
  code-default no-ops, so removing them restores prior behavior.
- The deploy/CI workflow changes live in git — revert the PR to undo.

## GitHub Actions minutes (already applied)

- **`deploy-vercel.yml`** uses `vercel deploy --prod --no-wait`: the runner queues
  the deploy and exits in ~1 min instead of idling the whole 11–32 min remote
  build (~30 GH-min saved per client deploy). **Trade-off:** the Actions job goes
  green even if the remote build later fails — **watch the Vercel dashboard, not
  just Actions.** `smoke.yml` still fires only on a *successful* deploy.
- **`performance.yml`** nightly cron removed; JMeter still runs on PRs + on demand.

## Baseline reference (POOL=4, pre-tuning)

Last 5 prod builds before tuning, for comparison when judging a POOL change:

| commit | build |
|---|---|
| #388 | 32.0 min |
| #387 | 22.8 min |
| #383 | 15.6 min |
| #386 | 11.1 min |
| #379 | 10.9 min |

~18.5 min average, 3× spread on near-identical code — so judge a POOL change over
**several** deploys, not one.

## Deferred

Moving prerender off Vercel's build clock entirely (e.g. a scheduled job that
writes static HTML) removes the 45-min cap as a concern but is a real refactor.
The code comments in `prerender.mjs` already flag this ("move the build off
Vercel's clock"). Not worth it until the knobs above stop being enough.
