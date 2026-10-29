'use strict';
/**
 * backfillLeads.js — one-time (re-runnable) import of existing hosts + guests
 * into the CRM `leads` table.
 *
 * Usage:  node server/scripts/backfillLeads.js
 *
 * Idempotent: upsertLead dedups on phone → email and merges (never clobbers a
 * populated field), so running it again only fills gaps and links new profiles.
 * After importing it runs the attribution pass to stitch revenue.
 *
 * Guests are profiles with is_host=false; hosts have is_host=true. Source is set
 * accordingly. Pipeline status is left at the default 'new' — the backfill never
 * regresses a status set by the sales team (upsertLead skips status on re-sync).
 */
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const leadService = require('../services/crm/leadService');
const attribution = require('../services/crm/attribution');

const PAGE = 500;

async function backfill() {
  let from = 0, created = 0, merged = 0, skipped = 0;
  for (;;) {
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, phone, email, is_host, profession, primary_category, location, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!profiles?.length) break;

    for (const p of profiles) {
      if (!p.phone && !p.email) { skipped++; continue; }
      try {
        const { created: isNew } = await leadService.upsertLead(
          {
            profile_id: p.id,
            name: p.name || '',
            phone: p.phone || '',
            whatsapp_phone: p.phone || '',
            email: p.email || '',
            profession: p.profession || p.primary_category || '',
            city: p.location || '',
          },
          { source: p.is_host ? 'host_signup' : 'guest_booking', createdBy: 'backfill' },
        );
        if (isNew) created++; else merged++;
      } catch (err) {
        console.error(`  ! profile ${p.id}: ${err.message}`);
        skipped++;
      }
    }
    console.log(`  …processed ${from + profiles.length} profiles (created ${created}, merged ${merged}, skipped ${skipped})`);
    if (profiles.length < PAGE) break;
    from += PAGE;
  }
  return { created, merged, skipped };
}

(async () => {
  console.log('Backfilling leads from profiles…');
  const r = await backfill();
  console.log(`Import done: ${r.created} created, ${r.merged} merged, ${r.skipped} skipped.`);
  console.log('Running attribution (link + revenue)…');
  const a = await attribution.run();
  console.log(`Attribution: ${a.linked} linked, ${a.updated} revenue-refreshed.`);
  process.exit(0);
})().catch((err) => { console.error('Backfill failed:', err); process.exit(1); });
