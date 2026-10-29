/**
 * seedServiceCategories.js — idempotent seed of the profession-scoped
 * service_categories table from config/serviceCategorySeed.js.
 *
 * For each primary_category, inserts one row per service name (slug derived from
 * the name, unique within the profession) with display_order = position in list.
 * Re-running only fills gaps: existing (primary_category, slug) rows are left
 * untouched so admin edits / deactivations are never clobbered.
 *
 * Run: node scripts/seedServiceCategories.js
 */
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const { SERVICE_CATEGORY_SEED } = require('../config/serviceCategorySeed');

// Mirrors serviceCategoryController.slugify (kept in sync intentionally).
const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// v3.60 not applied yet? insert/update will fail on the missing `description`
// column -- degrade to names-only seeding instead of hard-failing the run.
const isMissingDescriptionColumn = (err) =>
  err && /description/i.test(err.message || '') &&
  /Could not find the|column .* does not exist/i.test(err.message || '');

async function run() {
  let inserted = 0;
  let skipped = 0;
  let descriptionsFilled = 0;
  let schemaHasDescription = true;
  const professions = Object.keys(SERVICE_CATEGORY_SEED);

  for (const primary of professions) {
    const entries = (SERVICE_CATEGORY_SEED[primary] || []).map((e) =>
      typeof e === 'string' ? { name: e, description: null } : e
    );

    // Existing slugs for this profession → skip duplicates (idempotent).
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('service_categories')
      .select('slug')
      .eq('primary_category', primary);
    if (exErr) throw exErr;
    const have = new Set((existing || []).map((r) => r.slug));

    const rows = [];
    const seen = new Set(have);
    entries.forEach(({ name, description }, i) => {
      let slug = slugify(name);
      if (!slug || seen.has(slug)) return; // collision within profession → skip
      seen.add(slug);
      rows.push({ primary_category: primary, name, slug, display_order: i, is_active: true, description: description || null });
    });

    if (rows.length > 0) {
      let insErr = null;
      if (schemaHasDescription) {
        ({ error: insErr } = await supabaseAdmin.from('service_categories').insert(rows));
        if (insErr && isMissingDescriptionColumn(insErr)) {
          console.log('v3.60 not applied -- seeding names only');
          schemaHasDescription = false;
          insErr = null;
        }
      }
      if (!schemaHasDescription) {
        const namesOnlyRows = rows.map(({ description, ...rest }) => rest);
        ({ error: insErr } = await supabaseAdmin.from('service_categories').insert(namesOnlyRows));
      }
      if (insErr) throw insErr;
      inserted += rows.length;
      console.log(`  ${primary}: +${rows.length} (${have.size} already present)`);
    }
    skipped += entries.length - rows.length;

    // Existing rows: fill description ONLY where NULL (never clobber admin copy).
    if (schemaHasDescription) {
      for (const { name, description } of entries) {
        if (!description) continue;
        const slug = slugify(name);
        if (!have.has(slug)) continue; // just inserted with description above
        const { data: updData, error: updErr } = await supabaseAdmin
          .from('service_categories')
          .update({ description })
          .eq('primary_category', primary)
          .eq('slug', slug)
          .is('description', null)
          .select('slug');
        if (updErr) {
          if (isMissingDescriptionColumn(updErr)) {
            console.log('v3.60 not applied -- seeding names only');
            schemaHasDescription = false;
            break;
          }
          throw updErr;
        }
        // Count actual filled rows: the .is('description', null) guard means most
        // re-runs update 0 rows here.
        descriptionsFilled += (updData || []).length;
      }
    }
  }

  console.log(`\nDone. Seeded ${professions.length} professions → ${inserted} inserted, ${descriptionsFilled} descriptions filled, ${skipped} skipped.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
