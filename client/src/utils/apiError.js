// Pull the clearest message out of an axios error.
//
// The server's express-validator middleware returns 422 with
// `{ message: 'Validation failed', errors: [{ field, message }] }`. Showing only
// `message` hides WHICH field failed, so a save that trips a field cap reads as a
// generic "Validation failed" (this is exactly what made the service-page
// long_description 422 look random). Prefer the first field-level message so the
// toast names the field + reason; fall back to the top-level message, then a
// caller-supplied fallback.
export function fieldError(err, fallback = 'Something went wrong') {
  const data = err?.response?.data;
  return data?.errors?.[0]?.message || data?.message || err?.message || fallback;
}
