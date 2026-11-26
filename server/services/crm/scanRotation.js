'use strict';
/**
 * scanRotation.js — make a batched CRM scan actually walk the whole table.
 *
 * The lifecycle and guest engines read BATCH rows per tick. They used to order by
 * updated_at, which nothing bumps, so every tick re-read the SAME oldest rows and
 * the rest were never scored (2026-11-26: 500 of 11,001 leads, 2 of 2,219 guest
 * contacts). They now order by health_computed_at (never-evaluated first) and,
 * after a tick, stamp every row they evaluated — including rows whose health did
 * not change and was therefore not written — so the next tick moves on.
 */
const { supabaseAdmin } = require('../../config/supabase');

// Chunked so the `id IN (...)` list stays well inside URL limits.
const CHUNK = 100;

/** Stamp health_computed_at=now on `ids` in `table`. Best-effort; never throws. */
async function stampEvaluated(table, ids, now = Date.now()) {
  const at = new Date(now).toISOString();
  for (let i = 0; i < ids.length; i += CHUNK) {
    try {
      const { error } = await supabaseAdmin.from(table)
        .update({ health_computed_at: at }).in('id', ids.slice(i, i + CHUNK));
      if (error) { console.warn(`[crm] scan rotation stamp on ${table}:`, error.message); return; }
    } catch (e) {
      console.warn(`[crm] scan rotation stamp on ${table}:`, e.message);
      return;
    }
  }
}

module.exports = { stampEvaluated, CHUNK };
