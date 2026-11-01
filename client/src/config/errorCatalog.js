// errorCatalog — the single config that drives every branded error page.
//
// WHY this exists: adding a new error page must be a ONE-LINE config entry, not a
// new component. <ErrorPage code={n} /> reads its title/copy/CTA/illustration from
// here; <ErrorLayout> renders it. To support a new HTTP status, add an entry below
// and (if it needs its own URL) a <Route> in App.jsx + the segment in
// reservedSegments.js. Nothing else.
//
// Each entry:
//   title    — short, human, calm (sentence case, no "Error N")
//   message  — one or two plain sentences; never expose technical detail
//   art      — illustration key (see ErrorIllustration.jsx)
//   cta      — the SINGLE primary action. action ∈ ACTIONS below.
//
// Copy voice: calm and reassuring, lightly on-brand (unhurried). Reads as
// part of the product, not a server stack trace.

// CTA behaviours. ErrorPage maps each to a handler — keep this list and the
// switch in ErrorPage.jsx in sync.
export const ACTIONS = Object.freeze({
  BACK: 'back',        // history back (falls back to home if no history)
  HOME: 'home',        // navigate to '/'
  DASHBOARD: 'dashboard', // navigate to '/dashboard'
  LOGIN: 'login',      // navigate to '/login'
  RELOAD: 'reload',    // re-request the current URL
});


export const ERROR_CATALOG = Object.freeze({
  400: {
    title: "That didn't quite land",
    message: "Something about that request got garbled on the way over. Let's give it another shot.",
    art: 'confused',
    cta: { label: 'Go Back', action: ACTIONS.BACK },
  },
  401: {
    title: "You'll need to sign in",
    message: 'This page is for members. Sign in and we’ll bring you right back here.',
    art: 'locked',
    cta: { label: 'Sign In', action: ACTIONS.LOGIN },
  },
  403: {
    title: "This door's closed",
    message: 'You don’t have permission to view this page. If that seems off, check you’re signed in to the right account.',
    art: 'locked',
    cta: { label: 'Go to Dashboard', action: ACTIONS.DASHBOARD },
  },
  404: {
    title: 'This page pulled a vanishing act',
    message: "We looked everywhere, magnifying glass and all, but this page isn't here. It may have moved, or it never existed.",
    art: 'lost',
    image: true,
    cta: { label: 'Go Home', action: ACTIONS.HOME },
  },
  405: {
    title: "That move isn't allowed here",
    message: 'This action can’t be done on this page.',
    art: 'confused',
    cta: { label: 'Go Back', action: ACTIONS.BACK },
  },
  408: {
    title: 'That took a little too long',
    message: 'The connection timed out before we could finish. Give it another go.',
    art: 'timeout',
    cta: { label: 'Try Again', action: ACTIONS.RELOAD },
  },
  409: {
    title: 'Things got out of sync',
    message: 'This was updated somewhere else while you were here. Refresh to see the latest.',
    art: 'sync',
    cta: { label: 'Refresh', action: ACTIONS.RELOAD },
  },
  410: {
    title: "This one's gone for good",
    message: 'We looked, but this page was permanently removed and isn’t coming back.',
    art: 'lost',
    image: true,
    cta: { label: 'Go Home', action: ACTIONS.HOME },
  },
  413: {
    title: "That file's a bit too big",
    message: 'Your upload is over the size limit. Try a smaller one.',
    art: 'upload',
    cta: { label: 'Choose Another File', action: ACTIONS.BACK },
  },
  415: {
    title: "We can't open that file type",
    message: 'That format isn’t supported here. Try a different file.',
    art: 'upload',
    cta: { label: 'Choose Another File', action: ACTIONS.BACK },
  },
  422: {
    title: 'Almost there',
    message: 'A few details need a quick fix before we can continue. Check the highlighted fields.',
    art: 'form',
    cta: { label: 'Review Form', action: ACTIONS.BACK },
  },
  429: {
    title: 'Easy there, speedster',
    message: 'You’ve sent a lot of requests in a short time. Take a breath and try again in a moment.',
    art: 'timeout',
    cta: { label: 'Try Again Later', action: ACTIONS.BACK },
  },
  500: {
    title: 'Something went sideways',
    message: 'That one’s on us, not you. We’ve been notified and we’re already looking into it.',
    art: 'napping',
    cta: { label: 'Try Again', action: ACTIONS.RELOAD },
  },
  502: {
    title: 'We hit a bad connection',
    message: 'A service we rely on isn’t responding right now. Give it a moment.',
    art: 'napping',
    cta: { label: 'Retry', action: ACTIONS.RELOAD },
  },
  503: {
    title: "We'll be right back",
    message: 'We’re doing a little maintenance. Hang tight, this won’t take long.',
    art: 'maintenance',
    cta: { label: 'Refresh', action: ACTIONS.RELOAD },
  },
  504: {
    title: 'That took longer than expected',
    message: 'The server didn’t respond in time. Let’s try that again.',
    art: 'timeout',
    cta: { label: 'Try Again', action: ACTIONS.RELOAD },
  },
  offline: {
    title: "You're offline",
    message: 'No connection right now. We’ll reconnect you automatically the moment you’re back online.',
    art: 'offline',
    cta: { label: 'Try Again', action: ACTIONS.RELOAD },
  },
});

// Fallback used when an unknown code is requested — never render a blank page.
export const FALLBACK_CODE = 500;

export function getErrorEntry(code) {
  const key = String(code);
  return ERROR_CATALOG[key] || ERROR_CATALOG[String(FALLBACK_CODE)];
}

export default ERROR_CATALOG;
