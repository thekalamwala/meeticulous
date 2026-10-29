/**
 * searchSanitize.js — make user-supplied search terms safe for PostgREST
 * `.or()` / `.ilike()` filters.
 *
 * PostgREST parses the or() grammar with commas (condition separators) and
 * parentheses (grouping); `%`/`*`/`_` are wildcards. A raw user term containing
 * these can break out of its intended condition (filter injection). We strip
 * those metacharacters and cap length.
 */

const sanitizeLikeTerm = (s, maxLen = 80) =>
  String(s == null ? '' : s)
    .replace(/[,()%*_\\]/g, '')
    .trim()
    .slice(0, maxLen);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => UUID_RE.test(String(s || ''));

module.exports = { sanitizeLikeTerm, isUuid };
