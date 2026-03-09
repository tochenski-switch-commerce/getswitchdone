const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),

  // Use Turbopack for dev server stability (avoids Webpack OOM / crash on large files)
  // This is applied via the dev command below — no config key needed for Next 15.

  // Suppress file-tracing warnings from the home-directory lockfile
  serverExternalPackages: [],

  // Tree-shake large packages — only import what's actually used
  optimizePackageImports: ['@supabase/supabase-js', 'ai', 'zod'],
};

module.exports = nextConfig;
