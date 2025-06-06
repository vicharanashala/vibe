import esbuild from 'esbuild';
import pkg from './package.json' with { type: 'json' };

esbuild.build({
  entryPoints: ['src/index.ts'],
  outfile: 'build/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  loader: {
    '.node': 'copy', // 👈 this will copy .node files
  },
  external: [
    // ...Object.keys(pkg.dependencies || {}),
    '@koa/cors',
    'perf_hooks',
     // ✅ Prevent esbuild from trying to bundle this unused Koa dependency
  ],
  plugins: [],
  minify: true,
  sourcemap: true,
  metafile: true
}).catch(() => process.exit(1));
