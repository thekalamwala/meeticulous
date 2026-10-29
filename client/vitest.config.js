import { defineConfig } from 'vitest/config';
// No @vitejs/plugin-react* here — Vitest 4's internal Vite 6 transforms JSX via
// its built-in OXC pipeline. Adding either plugin causes deprecation warnings
// because both set optimizeDeps.esbuildOptions which Vite 6 has deprecated.
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const ROOT = process.cwd();
const NM   = path.join(ROOT, 'node_modules');
const _require = createRequire(NM + '/.package-lock.json');

function resolveCondition(obj, conditions) {
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object' || obj === null) return null;
  for (const c of conditions) {
    if (obj[c] != null) {
      const sub = resolveCondition(obj[c], conditions);
      if (sub) return sub;
    }
  }
  return null;
}

function resolvePackage(id, importerDir, conditions) {
  const parts   = id.startsWith('@') ? id.split('/').slice(0, 2) : [id.split('/')[0]];
  const pkgName = parts.join('/');
  const subPath = id.slice(pkgName.length);

  const searchBases = [NM, importerDir && path.join(importerDir, 'node_modules'), importerDir].filter(Boolean);

  for (const base of searchBases) {
    const pkgDir      = path.join(base, pkgName);
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) continue;

    let pkg;
    try { pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8')); } catch (_) { continue; }

    if (subPath) {
      const subKey = '.' + subPath;
      const expSub = pkg.exports && pkg.exports[subKey];
      if (expSub) {
        const entry = resolveCondition(expSub, conditions);
        if (entry) {
          const resolved = path.resolve(pkgDir, entry);
          if (fs.existsSync(resolved)) return resolved;
        }
      }
      const direct = path.resolve(pkgDir, subPath.slice(1));
      for (const ext of ['', '.js', '.mjs', '.cjs', '/index.js', '/index.mjs']) {
        if (fs.existsSync(direct + ext)) return direct + ext;
      }
      return null;
    }

    if (pkg.exports) {
      const dot   = pkg.exports['.'] || pkg.exports;
      const entry = resolveCondition(dot, conditions);
      if (entry) {
        const resolved = path.resolve(pkgDir, entry);
        if (fs.existsSync(resolved)) return resolved;
      }
    }
    for (const field of ['module', 'main']) {
      if (pkg[field]) {
        const resolved = path.resolve(pkgDir, pkg[field]);
        if (fs.existsSync(resolved)) return resolved;
      }
    }
  }
  return null;
}

function nodeResolvePlugin() {
  return {
    name: 'node-resolve-fallback',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!id || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return null;
      if (id.startsWith('node:') || ['module', 'fs', 'path', 'url', 'os', 'crypto', 'events', 'stream', 'util', 'child_process', 'process'].includes(id)) return null;

      const conditions = ['import', 'module', 'browser', 'default'];
      const importerDir = importer ? path.dirname(importer) : ROOT;
      const resolved = resolvePackage(id, importerDir, conditions);
      return resolved || null;
    },
  };
}

// Resolve relative imports that Vite 8 / Rolldown fails to find in the test
// worker (no extension → tries to load without .js/.jsx suffix).
function relativeResolvePlugin() {
  const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx'];
  return {
    name: 'relative-resolve-fallback',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!id || (!id.startsWith('./') && !id.startsWith('../'))) return null;
      if (!importer) return null;
      const base = path.resolve(path.dirname(importer), id);
      if (path.extname(base)) return null;
      for (const ext of EXTENSIONS) {
        const candidate = base + ext;
        if (fs.existsSync(candidate)) return candidate;
      }
      return null;
    },
  };
}

export default defineConfig({
  root: ROOT,
  // Help articles import ../docs/help/*.md (repo root, outside the client root).
  // Let the test module-server read the parent dir, same as vite.config.js does.
  server: { fs: { allow: [ROOT, path.resolve(ROOT, '..')] } },
  plugins: [nodeResolvePlugin(), relativeResolvePlugin()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  test: {
    root: ROOT,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.js'],
    // Dummy Supabase creds so modules that call createClient() at import time
    // (services/supabaseClient.js) don't throw "supabaseUrl is required" in CI,
    // where no .env is present. Available on import.meta.env + process.env.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    deps: {
      web: {
        // Force source JSX files through Vite's transform pipeline (rpc.transform)
        // in the ExternalModulesExecutor. Without this, JSX imported by test files
        // is loaded raw and vm.SourceTextModule fails with "Unexpected token '<'".
        transformGlobPattern: [/\/src\/(?!tests\/).*\.jsx$/],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/tests/**', 'src/main.jsx'],
      thresholds: { lines: 60, functions: 60 },
    },
  },
});
