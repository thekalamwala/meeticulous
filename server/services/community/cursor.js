'use strict';
// Keyset pagination cursor: base64url of `${ts}|${id}`.

// Strict formats: ts/id get interpolated into PostgREST .or() filters, so nothing else may pass.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

const encodeCursor = (ts, id) => Buffer.from(`${ts}|${id}`).toString('base64url');

function decodeCursor(str) {
  if (typeof str !== 'string' || !str) return null;
  const s = Buffer.from(str, 'base64url').toString();
  const i = s.indexOf('|');
  if (i < 1) return null;
  const ts = s.slice(0, i), id = s.slice(i + 1);
  if (!UUID_RE.test(id) || !ISO_RE.test(ts) || Number.isNaN(Date.parse(ts))) return null;
  return { ts, id };
}

module.exports = { encodeCursor, decodeCursor };
