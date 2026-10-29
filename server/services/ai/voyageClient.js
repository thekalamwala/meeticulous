'use strict';
// Voyage AI embeddings — key-optional. Returns null when VOYAGE_API_KEY is unset so
// semantic retrieval degrades gracefully to full-text search (mirrors anthropicClient).
// Powers Bolt's hybrid KB retrieval + (later) semantic cache (SIE phase B).

const MODEL = 'voyage-3.5-lite';
const DIM = 1024;                 // voyage-3.5-lite default output dimension
const ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const TIMEOUT_MS = 6000;         // fail-fast: a slow embed must not hang the bot

const isConfigured = () => Boolean(process.env.VOYAGE_API_KEY);

// Embed one or more texts. inputType: 'document' for stored chunks, 'query' for a
// user question (Voyage tunes the two differently). Returns number[][], or null when
// unconfigured. Throws on API/timeout error so callers can fall back to FTS.
async function embed(texts, inputType = 'query') {
  if (!isConfigured()) return null;
  const input = (Array.isArray(texts) ? texts : [texts]).filter((t) => String(t || '').trim());
  if (!input.length) return [];

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.VOYAGE_API_KEY}` },
      body: JSON.stringify({ input, model: MODEL, input_type: inputType, output_dimension: DIM }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`voyage ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    const json = await res.json();
    return (json.data || []).map((d) => d.embedding);
  } finally {
    clearTimeout(timer);
  }
}

// Embed a single query → one vector, or null when unconfigured.
async function embedQuery(text) {
  const out = await embed([text], 'query');
  return out && out.length ? out[0] : null;
}

module.exports = { embed, embedQuery, isConfigured, MODEL, DIM };
