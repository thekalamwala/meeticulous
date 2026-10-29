'use strict';
/**
 * stateService.js — the SINGLE authoritative representation of Indian states /
 * union territories and their GST state codes (01–38), plus place-of-supply
 * resolution. Everything that needs a state for tax — invoiceService (CGST/SGST
 * vs IGST), both checkout validators, and the client billing dropdown — routes
 * through here so "Odisha" / "Orissa" / "OD" / "21" all collapse to one truth.
 *
 * Pure, no DB, no side effects. GST state codes per the CBIC/GSTN TIN scheme.
 * The 36 active jurisdictions (28 states + 8 UTs) are canonical; obsolete codes
 * (25 Daman & Diu, 28 old Andhra Pradesh) are kept ONLY as normalization aliases
 * so legacy data still resolves — they are never offered for new selection.
 */

// Canonical 28 states + 8 UTs. `aliases` cover spelling/legacy variants and the
// obsolete pre-merger code where one exists. Order = display order (alphabetical).
const STATES = Object.freeze([
  { code: '37', name: 'Andhra Pradesh', aliases: ['AP', '28'] },       // 28 = pre-bifurcation AP (obsolete)
  { code: '12', name: 'Arunachal Pradesh', aliases: ['AR'] },
  { code: '18', name: 'Assam', aliases: ['AS'] },
  { code: '10', name: 'Bihar', aliases: ['BR'] },
  { code: '22', name: 'Chhattisgarh', aliases: ['CG', 'Chattisgarh'] },
  { code: '30', name: 'Goa', aliases: ['GA'] },
  { code: '24', name: 'Gujarat', aliases: ['GJ'] },
  { code: '06', name: 'Haryana', aliases: ['HR'] },
  { code: '02', name: 'Himachal Pradesh', aliases: ['HP'] },
  { code: '20', name: 'Jharkhand', aliases: ['JH'] },
  { code: '29', name: 'Karnataka', aliases: ['KA'] },
  { code: '32', name: 'Kerala', aliases: ['KL'] },
  { code: '23', name: 'Madhya Pradesh', aliases: ['MP'] },
  { code: '27', name: 'Maharashtra', aliases: ['MH'] },
  { code: '14', name: 'Manipur', aliases: ['MN'] },
  { code: '17', name: 'Meghalaya', aliases: ['ML'] },
  { code: '15', name: 'Mizoram', aliases: ['MZ'] },
  { code: '13', name: 'Nagaland', aliases: ['NL'] },
  { code: '21', name: 'Odisha', aliases: ['OD', 'Orissa'] },
  { code: '03', name: 'Punjab', aliases: ['PB'] },
  { code: '08', name: 'Rajasthan', aliases: ['RJ'] },
  { code: '11', name: 'Sikkim', aliases: ['SK'] },
  { code: '33', name: 'Tamil Nadu', aliases: ['TN', 'Tamilnadu'] },
  { code: '36', name: 'Telangana', aliases: ['TS', 'TG'] },
  { code: '16', name: 'Tripura', aliases: ['TR'] },
  { code: '09', name: 'Uttar Pradesh', aliases: ['UP'] },
  { code: '05', name: 'Uttarakhand', aliases: ['UK', 'UA', 'Uttaranchal'] },
  { code: '19', name: 'West Bengal', aliases: ['WB'] },
  // Union Territories
  { code: '35', name: 'Andaman and Nicobar Islands', aliases: ['AN', 'Andaman & Nicobar Islands', 'Andaman and Nicobar'] },
  { code: '04', name: 'Chandigarh', aliases: ['CH'] },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu', aliases: ['DN', 'DD', '25', 'Daman and Diu', 'Dadra and Nagar Haveli', 'Dadra & Nagar Haveli and Daman & Diu'] }, // 25 = obsolete Daman & Diu
  { code: '07', name: 'Delhi', aliases: ['DL', 'New Delhi', 'NCT of Delhi'] },
  { code: '01', name: 'Jammu and Kashmir', aliases: ['JK', 'J&K', 'Jammu & Kashmir'] },
  { code: '38', name: 'Ladakh', aliases: ['LA', 'LADAKH'] },
  { code: '31', name: 'Lakshadweep', aliases: ['LD'] },
  { code: '34', name: 'Puducherry', aliases: ['PY', 'Pondicherry'] },
]);

// "Other Territory" (97) is a valid GST place-of-supply for offshore/EEZ supplies.
// Accepted for validation but not offered in the picker.
const OTHER_TERRITORY = Object.freeze({ code: '97', name: 'Other Territory', aliases: ['OT'] });

const norm = (s) => String(s == null ? '' : s).trim().toUpperCase().replace(/\s+/g, ' ');

// Lookup indexes built once.
const BY_CODE = new Map();
const BY_NAME = new Map(); // normalized name/alias -> canonical {code,name}
for (const st of [...STATES, OTHER_TERRITORY]) {
  const canonical = { code: st.code, name: st.name };
  BY_CODE.set(st.code, canonical);
  BY_NAME.set(norm(st.name), canonical);
  for (const a of st.aliases || []) BY_NAME.set(norm(a), canonical);
}

/** True if `code` is a currently-valid GST state code (01–38, or 97). */
function isValidStateCode(code) {
  return BY_CODE.has(String(code == null ? '' : code).trim());
}

/**
 * Normalize any state input — a 2-digit code, a canonical name, an alias, an
 * abbreviation, or a legacy spelling — to `{ code, name }`, or null if unknown.
 */
function normalizeState(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  // A bare 2-digit code (accept "1" → "01"). Try the canonical code first, then
  // fall back to the alias index so obsolete numeric codes (25, 28) still resolve.
  if (/^\d{1,2}$/.test(raw)) {
    const padded = raw.padStart(2, '0');
    return BY_CODE.get(padded) || BY_NAME.get(padded) || null;
  }
  return BY_NAME.get(norm(raw)) || null;
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
/** True if `g` is a structurally valid 15-char GSTIN. */
function isValidGstin(g) {
  return typeof g === 'string' && GSTIN_RE.test(g.trim().toUpperCase());
}
/** The embedded state code from a valid GSTIN (first 2 chars), else null. */
function stateCodeFromGstin(g) {
  if (!isValidGstin(g)) return null;
  const code = g.trim().slice(0, 2);
  return isValidStateCode(code) ? code : null;
}

/**
 * Resolve the GST place of supply for a supply, from whatever billing signals
 * were captured. Precedence (most authoritative first):
 *   1. A valid GSTIN's embedded state code  (registered recipient — Sec 12(2)(a))
 *   2. An explicitly supplied stateCode      (validated against 01–38/97)
 *   3. A supplied state name/alias           (normalized to a code)
 * Returns { code, name, source, mismatch } or null when nothing usable is on
 * record — the caller then applies the lawful supplier-location default.
 *
 * `mismatch` is true when a GSTIN was given AND a state/stateCode was also given
 * but they disagree; the GSTIN wins (it is the registered fact), and the flag
 * lets a validator warn/reject rather than silently pick.
 */
function resolvePlaceOfSupply({ gstin, state, stateCode } = {}) {
  const fromGstin = stateCodeFromGstin(gstin);
  const fromExplicit = isValidStateCode(stateCode) ? BY_CODE.get(String(stateCode).trim().padStart(2, '0')) : null;
  const fromName = normalizeState(stateCode) || normalizeState(state);

  const chosen = (fromGstin && BY_CODE.get(fromGstin)) || fromExplicit || fromName || null;
  if (!chosen) return null;

  let mismatch = false;
  if (fromGstin) {
    const other = fromExplicit || fromName;
    if (other && other.code !== fromGstin) mismatch = true;
  }
  const source = fromGstin ? 'gstin' : fromExplicit ? 'state_code' : 'state_name';
  return { code: chosen.code, name: chosen.name, source, mismatch };
}

/**
 * Validate + canonicalize a raw billing_details object from a checkout request.
 * The backend is authoritative: it never trusts the frontend's tax/POS — it
 * re-derives the place of supply here and rewrites `state`/`state_code` to the
 * canonical pair. A valid GSTIN's state wins over any typed state (the registered
 * recipient's POS is their registration state).
 *
 * @param {object} raw  { name, address, state, state_code, gstin, pan }
 * @param {object} [opts]
 * @param {boolean} [opts.requireState=false]  reject when no state is resolvable
 * @returns {{ ok:true, billing:object|null } | { ok:false, error:string }}
 */
function normalizeBilling(raw = {}, { requireState = false } = {}) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const gstin = b.gstin ? String(b.gstin).trim().toUpperCase() : null;
  if (gstin && !isValidGstin(gstin)) {
    return { ok: false, error: 'Invalid GSTIN. Check the 15-character number and try again.' };
  }
  const pos = resolvePlaceOfSupply({ gstin, state: b.state, stateCode: b.state_code });
  if (!pos) {
    if (requireState) {
      return { ok: false, error: 'A valid billing state is required to issue your GST tax invoice.' };
    }
    // Nothing resolvable and not required — keep any identity fields the buyer gave
    // (name/address/gstin/pan) so the invoice still names them; POS will fall back
    // to the seller's state at mint time (the lawful supplier-location default).
    const any = b.name || b.address || gstin || b.pan;
    return {
      ok: true,
      billing: any ? {
        name: b.name ? String(b.name).trim() : null,
        address: b.address ? String(b.address).trim() : null,
        state: null, state_code: null,
        gstin: gstin || null,
        pan: b.pan ? String(b.pan).trim().toUpperCase() : null,
      } : null,
    };
  }
  return {
    ok: true,
    billing: {
      name: b.name ? String(b.name).trim() : null,
      address: b.address ? String(b.address).trim() : null,
      state: pos.name,        // canonical name — overrides whatever was typed
      state_code: pos.code,   // canonical GST code (drives CGST/SGST vs IGST)
      gstin: gstin || null,
      pan: b.pan ? String(b.pan).trim().toUpperCase() : null,
    },
  };
}

// Flat list for the client billing dropdown — active 36 only, display order.
const STATES_FOR_CLIENT = Object.freeze(STATES.map((s) => ({ code: s.code, name: s.name })));

module.exports = {
  STATES,
  STATES_FOR_CLIENT,
  OTHER_TERRITORY,
  isValidStateCode,
  normalizeState,
  isValidGstin,
  stateCodeFromGstin,
  resolvePlaceOfSupply,
  normalizeBilling,
  GSTIN_RE,
};
