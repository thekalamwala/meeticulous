# CAPACITY_ESTIMATE.md — Book A Sloth

_Phase 2 — Scalability Assessment. 2026-06-18._
_These are **engineering estimates**, clearly labelled. The only **measured** data point is the localhost baseline in `performance/docs/BENCHMARKS.md` (100 concurrent read users → 113.9 req/s, P95 873 ms, 0 errors, latency Tokyo-round-trip-bound). Production capacity has **not** been measured because no isolated test environment exists (`LOAD_TEST_BLOCKERS.md`). Numbers below are derived from architecture + tier specs and must be confirmed on staging before relied on._

## Model & assumptions

**Workload mix (typical booking SaaS):** ~85% reads (slots, profile, service, listings), ~15% writes (booking create, payment verify, auth). One "concurrent user" ≈ one active session with ~5–10 s think-time → **~0.1–0.2 req/s per user**. So *N* concurrent users ≈ **0.1N–0.2N sustained req/s**, with bursts higher.

**Per-request cost (architecture facts):**
- Reads: 3–5 Supabase round-trips (`available-slots`, `createBooking`); profile/service ~1–2.
- Authed requests: + one `supabaseAdmin.auth.getUser` network call (~175 ms today) — `authMiddleware.js:22`.
- Security middleware chain runs regex scans per request (`helmet`, `hpp`, `sanitizeBody`, `blockSuspiciousRequests`) — small but non-zero CPU — `server.js:64–68`.
- Single Node process = **one CPU core** (no clustering) — `server.js`.
- Heavy side-effects (emails, ledger, analytics) are **deferred** off the response — `utils/background.js`.

**Region note:** the localhost baseline pays a laptop→Tokyo hop per query (~150–250 ms). In production with the app **co-located near Supabase**, per-query RTT collapses to single-digit ms, so the *same code* is far faster — but then bounded by **single-core CPU** and **Supabase connection limits** instead of network latency.

**Tier specs assumed:**
| Tier | vCPU | RAM | Notes |
|---|---|---|---|
| Render Starter | ~0.5 | 512 MB | always-on (needed for crons) |
| Render Standard | ~1 | 2 GB | |
| Supabase Free | shared compute | ~500 MB DB | pooler ~ tens of connections; pauses when idle |
| Supabase Pro | dedicated compute add-on | 8 GB+ | transaction pooler, configurable connections, PITR |

---

## Capacity by stack (estimates)

Legend: ✅ comfortable · ⚠️ marginal (degraded P95 / needs tuning) · ❌ fails (errors / pool exhaustion / CPU saturation).

### A) Render Starter + Supabase Free — *current intended launch stack*
| Concurrent users | ~Sustained RPS | Verdict | Limiting factor |
|---|---|---|---|
| 100 | 10–20 | ✅ | fine |
| 500 | 50–100 | ⚠️ | 0.5 vCPU event loop + Supabase Free pooler start to bind |
| 1,000 | 100–200 | ❌ | single core saturates; Free connection pool exhausts on write bursts |
| 2,500+ | — | ❌ | not viable on this stack |

### B) Render Standard + Supabase Pro (pooler on)
| Concurrent users | ~Sustained RPS | Verdict | Limiting factor |
|---|---|---|---|
| 100 | 10–20 | ✅ | fine |
| 500 | 50–100 | ✅ | fine with pooler |
| 1,000 | 100–200 | ⚠️ | single core nears saturation; auth `getUser` floor amplifies |
| 2,500 | 250–500 | ❌ | one core can't serve it; need horizontal scale |
| 5,000–10,000 | 500–2,000 | ❌ | impossible single-instance |

### C) Recommended growth stack — multi-instance + Redis + Supabase Pro (pooler) + edge cache
| Concurrent users | ~Sustained RPS | Verdict | Requirement |
|---|---|---|---|
| 1,000 | 100–200 | ✅ | 2–3 instances behind LB, shared Redis limiter |
| 2,500 | 250–500 | ✅ | + edge cache on public reads, local JWT verify |
| 5,000 | 500–1,000 | ⚠️→✅ | + autoscale, Supabase compute sized, pooler tuned |
| 10,000 | 1,000–2,000 | ⚠️→✅ | + distributed load proven on staging; Supabase connection budget validated |

> The path to 10k is **horizontal app scale + Redis + edge cache + a sized Supabase**, not a bigger single box. The current single-process design tops out near **~1,000 concurrent users even on good hardware**.

---

## Resource estimates per scale (Recommended stack C)

| Users | App instances (1 vCPU each) | Peak Supabase connections* | App RAM (per instance) | CPU |
|---|---|---|---|---|
| 100 | 1 | 5–15 | 150–250 MB | low |
| 500 | 1–2 | 20–50 | 250–400 MB | moderate |
| 1,000 | 2–3 | 40–100 | 300–450 MB | moderate-high per core |
| 2,500 | 3–5 | 80–200 | 350–500 MB | high; autoscale |
| 5,000 | 5–8 | 150–350 | 400–550 MB | needs autoscale + pooler |
| 10,000 | 8–15 | 300–600 | 450–600 MB | needs autoscale + pooler + edge cache offloading reads |

*Connections assume the **transaction-mode pooler**; without it, raw connection count explodes far faster. Each app instance × concurrent in-flight queries → pooler slots. This is the **first hard wall** on Supabase and must be validated on staging.

---

## Three scenarios for "can it hit 10,000 concurrent today?"

- **Conservative:** ~**300–500 concurrent users** before P95 > 1 s / errors appear on the current single-process + Supabase Free/Pro stack. (Single core + auth `getUser` floor + connection limits.)
- **Expected:** ~**800–1,200 concurrent users** on Render Standard + Supabase Pro with pooler, reads dominating, before the single core saturates.
- **Optimistic:** ~**1,500–2,000 concurrent** if traffic is read-heavy *and* edge-cached, still single-instance — but write bursts will still bind earlier.

**10,000 concurrent is not reachable on any single-instance configuration.** It requires stack C. All figures above are estimates pending staging measurement.

---

## What only staging can confirm (do not trust estimates past ~500u)
- Real Supabase connection/pooler ceiling under write load.
- `bookings_no_overlap` exclusion-constraint lock contention on hot slots.
- Single-core RPS knee with the real security-middleware CPU cost.
- Auth `getUser` throughput against Supabase Auth's own limits.
- Memory behavior / leaks over a 30-min sustained run.

→ Provision per `STAGING_SETUP.md`, then run the ladder (`s10 … s10000`) for measured numbers; feed failures into `BOTTLENECK_ANALYSIS.md`.
