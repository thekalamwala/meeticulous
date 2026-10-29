// Canonical Indian states + union territories with their GST state codes (01–38).
// Mirror of server/services/stateService.js STATES_FOR_CLIENT — the SERVER remains
// authoritative for the tax determination; this list only drives the billing
// dropdown so the code (not a free-typed name) is captured at checkout.
// Display order = alphabetical (states, then UTs).
export const INDIAN_STATES = [
  { code: '37', name: 'Andhra Pradesh' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '18', name: 'Assam' },
  { code: '10', name: 'Bihar' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '30', name: 'Goa' },
  { code: '24', name: 'Gujarat' },
  { code: '06', name: 'Haryana' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '20', name: 'Jharkhand' },
  { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '27', name: 'Maharashtra' },
  { code: '14', name: 'Manipur' },
  { code: '17', name: 'Meghalaya' },
  { code: '15', name: 'Mizoram' },
  { code: '13', name: 'Nagaland' },
  { code: '21', name: 'Odisha' },
  { code: '03', name: 'Punjab' },
  { code: '08', name: 'Rajasthan' },
  { code: '11', name: 'Sikkim' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '16', name: 'Tripura' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '19', name: 'West Bengal' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '04', name: 'Chandigarh' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '07', name: 'Delhi' },
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '38', name: 'Ladakh' },
  { code: '31', name: 'Lakshadweep' },
  { code: '34', name: 'Puducherry' },
];

// name lookup by code (for pre-filling a saved state_code back to its label).
export const stateNameByCode = (code) =>
  (INDIAN_STATES.find((s) => s.code === String(code || '').trim().padStart(2, '0')) || {}).name || '';
