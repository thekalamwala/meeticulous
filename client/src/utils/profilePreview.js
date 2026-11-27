// Live preview of the public profile inside Grow › Your page — the message contract.
//
// The editor loads the REAL page, /<username>?preview=1, in a same-origin iframe
// (phone width, so the page's own breakpoints give its phone layout) and posts the
// host's UNSAVED draft in. Nothing is saved; the draft never leaves the browser.
//
//   page → editor   { type: READY_MSG }                once the page is listening
//   editor → page   { type: DRAFT_MSG, host: {...} }   on load, on READY, on every edit
//
// `host` carries the Your page fields only (growModel PAGE_KEYS): name, profession,
// location, bio, profile_image, cover_image, theme_color, social_links. Both sides
// post with targetOrigin = window.location.origin and accept a message only when
// event.origin === window.location.origin (and from the expected window).
// The page side (merge the draft over the fetched host, skip view counting, noindex)
// lives in pages/HostProfile.jsx.
export const DRAFT_MSG = 'mt:profile-draft';
export const READY_MSG = 'mt:profile-preview-ready';
