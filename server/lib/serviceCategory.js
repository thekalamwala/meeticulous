// server/lib/serviceCategory.js
// A service's category must be one of the ACTIVE service categories defined for
// the host's PRIMARY profession (service_categories WHERE primary_category = …).
// See migration v3.53 and config/serviceCategorySeed.js.

// Pure decision. required=true → a category MUST be chosen when the profession
// has any active service categories (create). required=false → only validate
// membership when one is provided (update, where absent = "leave unchanged").
function validateServiceCategory({ category, validSlugs, required = false }) {
  const valid = Array.isArray(validSlugs) ? validSlugs.filter(Boolean) : [];
  const value = typeof category === 'string' ? category.trim() : '';

  if (!value) {
    if (required && valid.length) {
      return { ok: false, status: 400, message: 'A service category is required' };
    }
    return { ok: true, value: null };
  }
  // Profession has no service categories on record → nothing to validate against.
  if (!valid.length) return { ok: true, value: null };
  if (!valid.includes(value)) {
    return { ok: false, status: 400, message: `"${value}" is not a valid service category for your profession` };
  }
  return { ok: true, value };
}

// Load the host's primary category, then its active service-category slugs, then
// validate. supabaseAdmin is injected so the pure logic above stays unit-testable.
async function resolveAndValidateCategory(supabaseAdmin, hostId, category, opts = {}) {
  let validSlugs = [];
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('primary_category').eq('id', hostId).single();
  const primary = profile?.primary_category || null;

  if (primary) {
    const { data: rows } = await supabaseAdmin
      .from('service_categories')
      .select('slug')
      .eq('primary_category', primary)
      .eq('is_active', true);
    validSlugs = (rows || []).map((r) => r.slug);
  }
  const result = validateServiceCategory({ category, validSlugs, required: !!opts.required });
  if (!result.ok) return result;
  // The pair travels together: a stored category always carries the profession
  // it was validated against (composite FK fk_services_category, v3.60).
  return { ...result, primary: result.value ? primary : null };
}

// Clear the (category, primary_category) pair on a host's categorised services.
// Used when the host's profession changes: old slugs belong to the old
// profession's list. Returns the number of services cleared.
// Pre-v3.60 fallback clears `category` only.
async function clearHostServiceCategories(supabaseAdmin, hostId) {
  const now = new Date().toISOString();
  let clr = await supabaseAdmin
    .from('services')
    .update({ category: null, primary_category: null, updated_at: now })
    .eq('host_id', hostId)
    .not('category', 'is', null)
    .select('id');
  if (clr.error && /Could not find the|column .* does not exist/i.test(clr.error.message)) {
    clr = await supabaseAdmin
      .from('services')
      .update({ category: null, updated_at: now })
      .eq('host_id', hostId)
      .not('category', 'is', null)
      .select('id');
  }
  if (clr.error) throw clr.error;
  return (clr.data || []).length;
}

module.exports = { validateServiceCategory, resolveAndValidateCategory, clearHostServiceCategories };
