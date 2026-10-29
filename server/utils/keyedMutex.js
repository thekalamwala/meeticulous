/**
 * keyedMutex.js — serialize async critical sections by key within this process.
 *
 * Used to close the booking-quota check-then-insert race: two concurrent
 * bookings for the same host could both read count=N-1 and both insert, pushing
 * the host one over their yearly cap. Running the recheck+insert under
 * runExclusive(`booking-quota:<hostId>`) forces the second to observe the first's
 * row.
 *
 * SCOPE: in-process only. The platform runs as a single API instance today, so
 * this fully closes the race in practice. Across multiple instances it degrades
 * to the prior best-effort behavior (a cross-instance lock — Redis / a Postgres
 * advisory lock — is the Phase 3+ upgrade). It is NOT a substitute for a DB
 * constraint; it is the zero-infra, no-migration mitigation.
 *
 * Contract: calls with the same key run one at a time, in arrival order. A
 * rejection from one call does not break the chain for the next. The per-key
 * entry is dropped once its tail settles, so the map can't grow unbounded.
 */
const tails = new Map();

function runExclusive(key, fn) {
  const prev = tails.get(key) || Promise.resolve();
  // Run fn after prev settles, regardless of whether prev resolved or rejected,
  // so one caller's error never blocks the queue.
  const run = prev.then(fn, fn);
  // The chain tail must never reject (or the next waiter's prev would carry the
  // rejection); swallow it for chaining while callers still see the real result.
  const tail = run.catch(() => {});
  tails.set(key, tail);
  // Cleanup: when this tail is the current one and it has settled, drop the key.
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run; // callers await the real result/error of fn
}

module.exports = { runExclusive };
