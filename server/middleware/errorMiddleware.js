const { captureException } = require('../utils/sentry');
const { brandPage, wantsBrandedHtml } = require('../utils/brandPage');

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  // Report server-side failures (5xx) to Sentry; 4xx are client errors, not bugs.
  // No-op unless Sentry is configured.
  if (statusCode >= 500) {
    captureException(err, { path: req.originalUrl, method: req.method });
  }
  // Only surface specific messages for client errors (4xx) or errors explicitly
  // marked safe to expose. 5xx and unmarked errors get a generic message so we
  // don't leak DB driver / internal details to the client.
  const expose = err.expose === true || (statusCode >= 400 && statusCode < 500);
  const message = expose ? err.message : 'Something went wrong. Please try again.';

  // Browsers on non-API paths get the branded error page; API/JSON clients keep
  // the machine payload (the React app + integrations parse this).
  if (wantsBrandedHtml(req)) {
    // 404/410 get the branded not-found treatment matching the client + edge;
    // other codes keep the generic branded card.
    const isLost = statusCode === 404 || statusCode === 410;
    return res.status(statusCode).type('html').send(brandPage({
      code: statusCode,
      title: isLost ? 'Page not found' : 'Error',
      heading: isLost ? 'This page pulled a vanishing act' : 'Something went sideways',
      body: isLost
        ? "We searched high and low — magnifying glass and all — but this page isn't here. It may have moved, or it never existed."
        : message,
      hero: isLost,
    }));
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = errorHandler;
