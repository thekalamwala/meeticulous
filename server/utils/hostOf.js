// server/utils/hostOf.js
//
// Resolve the host profile embedded on a booking row.
//
// Bookings are queried with the un-aliased embed
// `profiles!bookings_host_id_fkey(...)`. supabase-js / PostgREST returns that
// embed under the *table-name* key `profiles` — the `!bookings_host_id_fkey`
// suffix is only a relationship-disambiguation hint and is NOT part of the
// response key. Reading `row["profiles!bookings_host_id_fkey"]` therefore yields
// `undefined`, so the host name/username/phone resolve empty and transactional
// emails render the literal "Host" (and the review-CTA link silently falls back
// to the dashboard). The client already guards both keys (CustomerBookings.jsx);
// this mirrors that on the server. The hinted key is checked first so existing
// fixtures/mocks that use it keep resolving.
const hostOf = (row) =>
  (row && (row["profiles!bookings_host_id_fkey"] || row.profiles)) || {};

module.exports = { hostOf };
