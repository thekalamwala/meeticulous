// Pure validation for a host's category selection.
// Shared by the plan-capped host endpoint and the uncapped admin override.
// max: positive integer cap, or -1 for unlimited.
function validateCategorySelection({ primary_category, categories, activeSlugs, max }) {
  const active = new Set(activeSlugs || []);
  let cats = Array.isArray(categories) ? categories.filter(Boolean) : [];
  cats = [...new Set(cats)]; // dedupe, preserve order

  const primary = primary_category || cats[0] || null;
  if (!primary) {
    return { ok: false, status: 400, message: 'A primary category is required' };
  }
  // Primary must lead the array and be present exactly once.
  cats = [primary, ...cats.filter((c) => c !== primary)];

  if (!active.has(primary)) {
    return { ok: false, status: 400, message: 'Primary category is not available' };
  }
  for (const c of cats) {
    if (!active.has(c)) {
      return { ok: false, status: 400, message: `Category "${c}" is not available` };
    }
  }
  if (max !== -1 && cats.length > max) {
    return {
      ok: false,
      status: 403,
      message: max <= 0
        ? 'Your plan does not allow changing categories. Contact admin.'
        : `Your plan allows up to ${max} categor${max === 1 ? 'y' : 'ies'}.`,
    };
  }
  return { ok: true, primary_category: primary, categories: cats };
}

module.exports = { validateCategorySelection };
