/**
 * Custom Jest resolver: bypasses unrs-resolver (Rust native binding)
 * which is missing on this Linux environment (only win32 binding was installed).
 * Falls back to Node's built-in require.resolve.
 */
const path = require('path');
const fs = require('fs');

module.exports = (request, options) => {
  const { basedir, defaultResolver, extensions = ['.js', '.json', '.node'] } = options;

  // Try defaultResolver first (may fail if unrs binding missing)
  try {
    return defaultResolver(request, options);
  } catch (_) {}

  // Fallback: use Node's require.resolve
  try {
    return require.resolve(request, { paths: [basedir] });
  } catch (_) {}

  // Last resort: try each extension manually for relative paths
  if (request.startsWith('.')) {
    const abs = path.resolve(basedir, request);
    for (const ext of extensions) {
      const candidate = abs + ext;
      if (fs.existsSync(candidate)) return candidate;
    }
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }

  throw new Error(`Cannot resolve module '${request}' from '${basedir}'`);
};
