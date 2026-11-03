'use strict';
// Keyset pagination cursor: base64url of `${ts}|${id}`.

const encodeCursor = (ts, id) => Buffer.from(`${ts}|${id}`).toString('base64url');

function decodeCursor(str) {
  if (typeof str !== 'string' || !str) return null;
  const s = Buffer.from(str, 'base64url').toString();
  const i = s.indexOf('|');
  if (i < 1) return null;
  const ts = s.slice(0, i), id = s.slice(i + 1);
  if (!id || Number.isNaN(Date.parse(ts))) return null;
  return { ts, id };
}

module.exports = { encodeCursor, decodeCursor };
