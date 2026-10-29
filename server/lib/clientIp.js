/**
 * clientIp.js — resolve the real client IP from a request.
 *
 * Standalone (depends only on ipBlockConfig) so ipGuard, security.js and the admin
 * auth controller can all share it without creating an import cycle.
 *
 * Default: express's req.ip, which is correct today behind Render's single proxy
 * (server.js sets trust proxy = 1). When an edge proxy (Cloudflare) is added it
 * forwards the real client in a header (e.g. cf-connecting-ip); set CLIENT_IP_HEADER
 * to that name and this reads the first value from it instead. Without that, all
 * traffic would appear to come from the edge's IP and a single ban would lock out
 * everyone. See docs/cloudflare-edge-setup.md.
 */

const config = require('../config/ipBlockConfig');

function getClientIp(req) {
  const header = config.clientIpHeader;
  if (header && req && req.headers) {
    const raw = req.headers[header];
    if (raw) {
      // X-Forwarded-For-style headers may be a list; the client is the first hop.
      const first = String(Array.isArray(raw) ? raw[0] : raw).split(',')[0].trim();
      if (first) return first;
    }
  }
  return req ? req.ip : undefined;
}

module.exports = { getClientIp };
