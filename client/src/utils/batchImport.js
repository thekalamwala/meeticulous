// Batch a large lead-import into small POSTs and sum the results.
//
// Two constraints shape this:
//  1. Body limit — a single ~1000-row POST trips the server's JSON body cap
//     (500 "request entity too large"), which silently failed the import modals.
//  2. Request timeout — the API client aborts a request after 30s. Server-side an
//     upsert costs ~1s (Render↔DB latency), so a batch must stay well under ~30
//     rows or the client times out mid-batch and stalls (the server commits the
//     batch, but the client aborts the rest — the import freezes at one chunk).
//
// So: small chunks (default 20, ~20s < the 30s cap) run with limited concurrency
// (default 4) for throughput, and a failed batch is counted as skipped rather than
// aborting the whole import. Pure — the caller injects `post`, so it's unit-testable.
//
// @param {(body:{rows:Array,listId:?string})=>Promise<{data:{created,merged,skipped,listId?}}>} post
// @param {Array} rows
// @param {?string} listId
// @param {number} chunk        rows per request (keep the batch under the client timeout)
// @param {number} concurrency  batches in flight at once
// @returns {Promise<{data:{created:number,merged:number,skipped:number,listId:?string}}>}
export async function batchedImport(post, rows, listId, chunk = 20, concurrency = 4) {
  const list = Array.isArray(rows) ? rows : [];
  const total = { created: 0, merged: 0, skipped: 0, listId: listId || null };
  const batches = [];
  for (let i = 0; i < list.length; i += chunk) batches.push(list.slice(i, i + chunk));

  const run = async (b) => {
    try {
      const { data } = await post({ rows: b, listId: total.listId });
      total.created += data?.created || 0;
      total.merged += data?.merged || 0;
      total.skipped += data?.skipped || 0;
      if (!total.listId && data?.listId) total.listId = data.listId;
    } catch {
      total.skipped += b.length; // a transient batch failure never aborts the rest of the import
    }
  };

  let start = 0;
  // If the list must be created inline, the first batch runs alone so it returns the
  // new list id before the concurrent waves start using it.
  if (!total.listId && batches.length) { await run(batches[0]); start = 1; }
  for (let i = start; i < batches.length; i += concurrency) {
    await Promise.all(batches.slice(i, i + concurrency).map(run));
  }
  return { data: total };
}
