/**
 * senderRegistry.js — resolves the FROM persona for an email.
 *
 * Each email_templates row may carry a `sender_key` (tithi / durga / sujata /
 * shubham / system). This maps that key → { from_name, from_email, reply_to }
 * from the `email_senders` table so lifecycle mail can come from a named person
 * (Durga celebrates a first booking; Tithi runs onboarding) instead of one
 * generic sender.
 *
 * Fails OPEN and schema-safe: if a template has no sender_key, the key is
 * unknown, the row is inactive, or the `email_senders` table doesn't exist yet
 * (migration not applied), it falls back to the global email_settings sender —
 * exactly today's behaviour. Nothing is ever blocked by a missing sender.
 */

'use strict';

const { supabaseAdmin } = require('../../config/supabase');

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, map: null };

/** All active senders, keyed by sender_key. Cached 60s; empty map on any error. */
async function loadSenders() {
  const now = Date.now();
  if (_cache.map && now - _cache.at < CACHE_TTL_MS) return _cache.map;
  const map = new Map();
  try {
    const { data, error } = await supabaseAdmin
      .from('email_senders').select('*').eq('active', true);
    if (!error) for (const s of data || []) map.set(s.sender_key, s);
  } catch (_) { /* table missing → empty map → global fallback */ }
  _cache = { at: now, map };
  return map;
}

function clearCache() { _cache = { at: 0, map: null }; }

/**
 * Resolve { fromName, fromEmail, replyTo } for a template.
 * @param {object|null} template  email_templates row (may be null/absent).
 * @param {object} settings       loaded email_settings (global fallback).
 */
async function senderFor(template, settings) {
  const key = template && template.sender_key;
  if (key) {
    const map = await loadSenders();
    const s = map.get(key);
    if (s) return { fromName: s.from_name, fromEmail: s.from_email, replyTo: s.reply_to || null };
  }
  return { fromName: settings.from_name, fromEmail: settings.from_email, replyTo: null };
}

/** Resolve a sender_key directly → { fromName, fromEmail, replyTo } or null when
 *  the key is empty/unknown/inactive (caller then uses the global default). */
async function byKey(senderKey) {
  if (!senderKey) return null;
  const s = (await loadSenders()).get(senderKey);
  return s ? { fromName: s.from_name, fromEmail: s.from_email, replyTo: s.reply_to || null } : null;
}

module.exports = { loadSenders, senderFor, byKey, clearCache };
