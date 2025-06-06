import esbuild from 'esbuild';
import pkg from './package.json' with { type: 'json' };

esbuild.build({
  entryPoints: ['build/index.js'],
  outfile: 'build/backend.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  loader: {
    '.node': 'copy',
  },
  external: [
    ...Object.keys(pkg.dependencies || {}),
    '@koa/cors',
    'perf_hooks',
  ],
  plugins: [],
  minify: true,
  sourcemap: true,
  metafile: true
}).catch(() => process.exit(1));
