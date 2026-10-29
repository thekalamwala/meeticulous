'use strict';
/**
 * listService.js — CRM Lists (cold contact pools). A list groups cold leads
 * (status='list', list_id=<this>). Promotion/sending reuse the lead pipeline.
 */
const { supabaseAdmin } = require('../../config/supabase');

async function createList({ name, source = null, consentBasis = null, description = null, createdBy = '' }) {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('list name required');
  const { data, error } = await supabaseAdmin.from('lead_lists')
    .insert({ name: clean, source, consent_basis: consentBasis, description, created_by: createdBy })
    .select('*').single();
  if (error) throw error;
  return data;
}

async function getList(id) {
  const { data } = await supabaseAdmin.from('lead_lists').select('*').eq('id', id).maybeSingle();
  return data || null;
}

// Lists newest-first, each with its live cold-lead count. Counts are derived
// (one head-count query per list) — no stored counter to drift. Fine at this scale.
async function listLists() {
  const { data, error } = await supabaseAdmin.from('lead_lists').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const lists = data || [];
  await Promise.all(lists.map(async (l) => {
    const { count } = await supabaseAdmin.from('leads')
      .select('id', { count: 'exact', head: true }).eq('list_id', l.id).eq('status', 'list');
    l.cold_count = count || 0;
  }));
  return lists;
}

module.exports = { createList, getList, listLists };
