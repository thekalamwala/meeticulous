/**
 * metrics.js — dependency-free process + HTTP metrics in Prometheus text format.
 *
 * Deliberately tiny (no prom-client): a handful of counters/gauges that are
 * useful to any scraper (Prometheus, Grafana Agent) or an ad-hoc curl, without
 * pulling a metrics framework for an endpoint that may go unscraped. The HTTP
 * middleware is always-on and O(1) per request (unlike the PERF_LOG debug
 * logger, which is opt-in and writes a line per request).
 */

let httpTotal = 0;
let httpSlow = 0; // requests slower than 1s
const byStatusClass = { '1xx': 0, '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };

function recordHttp(statusCode, ms) {
  httpTotal += 1;
  if (ms > 1000) httpSlow += 1;
  const cls = `${Math.floor(statusCode / 100)}xx`;
  if (byStatusClass[cls] !== undefined) byStatusClass[cls] += 1;
}

// Always-on, cheap: stamps each response's status + wall-clock into counters.
function middleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordHttp(res.statusCode, ms);
  });
  next();
}

function render() {
  const mem = process.memoryUsage();
  let cacheSize = 0;
  try { cacheSize = require('../services/responseCache')._size(); } catch (_) { /* optional */ }

  const lines = [
    '# HELP bas_uptime_seconds Process uptime in seconds.',
    '# TYPE bas_uptime_seconds gauge',
    `bas_uptime_seconds ${process.uptime().toFixed(0)}`,
    '# HELP bas_process_resident_memory_bytes Resident set size.',
    '# TYPE bas_process_resident_memory_bytes gauge',
    `bas_process_resident_memory_bytes ${mem.rss}`,
    '# HELP bas_process_heap_used_bytes V8 heap used.',
    '# TYPE bas_process_heap_used_bytes gauge',
    `bas_process_heap_used_bytes ${mem.heapUsed}`,
    '# HELP bas_response_cache_entries In-process response cache entry count.',
    '# TYPE bas_response_cache_entries gauge',
    `bas_response_cache_entries ${cacheSize}`,
    '# HELP bas_http_requests_total Total HTTP requests observed.',
    '# TYPE bas_http_requests_total counter',
    `bas_http_requests_total ${httpTotal}`,
    '# HELP bas_http_slow_requests_total HTTP requests slower than 1s.',
    '# TYPE bas_http_slow_requests_total counter',
    `bas_http_slow_requests_total ${httpSlow}`,
    '# HELP bas_http_requests_by_status Total HTTP requests by status class.',
    '# TYPE bas_http_requests_by_status counter',
    ...Object.entries(byStatusClass).map(
      ([cls, n]) => `bas_http_requests_by_status{class="${cls}"} ${n}`,
    ),
  ];
  return lines.join('\n') + '\n';
}

// Test seam.
function _reset() {
  httpTotal = 0;
  httpSlow = 0;
  for (const k of Object.keys(byStatusClass)) byStatusClass[k] = 0;
}

module.exports = { middleware, recordHttp, render, _reset };
