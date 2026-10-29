/**
 * pagination.js — safe list bounds for endpoints that historically returned an
 * unbounded array. The goal is a hard ceiling so a large account can't drag its
 * entire history over the wire on every dashboard load, WITHOUT breaking the
 * existing bare-array response shape.
 *
 * `?limit` and `?offset` are optional. When absent, `defaultLimit` applies; the
 * effective limit is always clamped to `maxLimit`. All real accounts today sit
 * far below these ceilings, so behaviour is identical for them — this only
 * prevents the pathological unbounded case. True UI cursor pagination (with a
 * total count) is a separate follow-up.
 */
function parseListRange(query = {}, { defaultLimit = 200, maxLimit = 500 } = {}) {
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(limit) || limit <= 0) limit = defaultLimit;
  limit = Math.min(limit, maxLimit);

  let offset = parseInt(query.offset, 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  return { limit, offset, from: offset, to: offset + limit - 1 };
}

module.exports = { parseListRange };
