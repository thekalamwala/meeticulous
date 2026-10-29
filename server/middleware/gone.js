'use strict';

// 410 Gone responder for endpoints that have been intentionally retired. Signals
// "this existed and is deliberately removed" (not a 404 typo), and lets any stale
// caller fail loudly with a clear message instead of silently succeeding.
const gone = (message = 'This endpoint has been removed.') =>
  (_req, res) => res.status(410).json({ message });

module.exports = { gone };
