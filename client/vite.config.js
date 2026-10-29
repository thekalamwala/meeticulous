import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command, mode }) => {
  // Guard: a production build without the Supabase env vars ships a bundle that
  // throws "supabaseUrl is required" at boot — a total white screen (2026-07-08
  // outage). Fail the build loudly instead of shipping it silently.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), '');
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_API_URL']
      .filter((k) => !env[k]);
    if (missing.length) {
      throw new Error(
        `Refusing to build: missing required env var(s): ${missing.join(', ')}. ` +
        'Set them in the build environment (Vercel project env / client/.env).',
      );
    }
  }

  return {
  plugins: [
    react(),
    // Dev-only bundle analysis. Off by default — set ANALYZE=1 to emit
    // dist/stats.html (treemap of chunk contents). Never affects normal builds.
    process.env.ANALYZE &&
      visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true, template: process.env.ANALYZE_JSON ? 'raw-data' : 'treemap' }),
  ].filter(Boolean),

  server: {
    // Honor a PORT env override (used by the preview harness) so the
    // managed browser and the dev server agree on the port; default 5173.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
    // Help-center articles are imported from ../docs/help/*.md (repo root, outside
    // the client root). Let the dev server read the parent dir; the build bundles
    // them regardless of this.
    fs: { allow: ['..'] },
  },

  build: {
    // Modern baseline — every browser we support runs es2022 (Chrome 94+,
    // Safari 15.4+, FF 93+). Stops esbuild down-levelling our own output.
    target: 'es2022',

    // Raise the warning threshold — vendor chunks are expected to be 500 KB+
    chunkSizeWarningLimit: 600,

    rollupOptions: {
      output: {
        // Split vendor libraries into stable, separately-cacheable chunks.
        // App code changes frequently; vendor code rarely does.
        manualChunks: {
          // Core React runtime — needed on every page, loads first
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-hot-toast'],
          // Supabase is large (~400 KB); split so it can be cached independently
          'vendor-supabase': ['@supabase/supabase-js'],
          // HTTP client
          'vendor-axios': ['axios'],
          // Animation libs (framer-motion is heavy) — isolate into their own
          // cacheable chunk instead of bloating the main app bundle the landing
          // page pulls. gsap is already dynamically imported (its own chunk).
          'vendor-motion': ['framer-motion', 'lenis'],
        },
      },
    },
  },
  };
});
