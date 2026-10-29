'use strict';
// Owns the Anthropic SDK instance + model ids. Key-optional: returns null when
// ANTHROPIC_API_KEY is unset so the feature degrades gracefully (no import crash).

// generate/regenerate = the shared workhorse model, used by the Bolt support bot,
// abuseGuard, pills, and escalationService as well as listing generation. Keep it
// on Haiku (cheap, high volume) — do NOT bump it to move one feature, or every
// bot call moves with it. `listing` is set separately so the bot's cost/behaviour
// stays put if you ever move listing to a different model.
const MODELS = {
  generate: 'claude-haiku-4-5-20251001',
  regenerate: 'claude-haiku-4-5-20251001',
  // Sonnet 5 for listing quality (per #589). NOTE: the real cause of the
  // 2026-07→08 "AI writing failed" outage was an INVALID prod ANTHROPIC_API_KEY
  // (Anthropic returned 401 "API key is invalid") — NOT the model. Every AI call
  // (bot included) failed until the key was rotated; the model id was a red
  // herring across #589/#634/#636/#637. BOLT_LISTING_MODEL overrides this without
  // a redeploy — e.g. set it to `claude-haiku-4-5-20251001` if the key lacks
  // Sonnet access. generateListing.thinkingParamFor() adapts the thinking param
  // to whichever model this resolves to. ponytail: one string + escape hatch.
  listing: process.env.BOLT_LISTING_MODEL || 'claude-sonnet-5',
};

let _client;

const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

const getClient = () => {
  if (!isConfigured()) return null;
  if (!_client) {
    const Anthropic = require('@anthropic-ai/sdk');
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
};

module.exports = { MODELS, isConfigured, getClient };
