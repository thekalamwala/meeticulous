/**
 * httpError.js — uniform, non-leaky error responses.
 *
 * Returns a generic message to the client while logging the real cause
 * server-side. Prevents leaking DB/driver details (table/column/constraint
 * names, schema-cache messages) in API responses, which aid enumeration and
 * injection crafting.
 */

const safeError = (
  res,
  err,
  status = 500,
  clientMessage = 'Something went wrong. Please try again.',
) => {
  if (err) console.error('[api error]', err?.message || err);
  return res.status(status).json({ message: clientMessage });
};

module.exports = { safeError };
