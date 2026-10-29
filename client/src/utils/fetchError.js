/**
 * fetchError.js — classify a rejected API call for public, prerendered pages.
 *
 * A rejection is a genuine "this resource does not exist" ONLY on an HTTP 404.
 * Every other rejection — a network error/timeout (no response), a 5xx, or a
 * 429/403 from an edge rate-limit or IP guard — is transient/environmental.
 *
 * Why this matters: data-driven public pages (blog posts, host/service pages)
 * render the branded ErrorPage on a failed fetch, and ErrorLayout hard-codes
 * `noindex`. A JS-rendering crawler (Google's WRS) that hits a transient API
 * failure would therefore render `noindex` over a LIVE, prerendered page and
 * drop it from search. Treating only a real 404 as "not found" keeps a live
 * page indexable through a blip. See BlogPost.jsx.
 */
export const isNotFoundError = (err) => err?.response?.status === 404;
