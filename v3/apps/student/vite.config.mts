/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/student',
  server: {
    port: 4300,
    host: 'localhost',
    // Same-origin access to the local backend and Firebase Auth emulator, so
    // the app works through a single SSH tunnel / port (see .env.example).
    proxy: {
      '/api': 'http://localhost:4001',
      '/identitytoolkit.googleapis.com': 'http://127.0.0.1:9099',
      '/securetoken.googleapis.com': 'http://127.0.0.1:9099',
      '/emulator': 'http://127.0.0.1:9099',
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
      // The package's default "main" is a Node build that needs @tensorflow/tfjs-node
      // (native bindings, never installed here) — force the browser/ESM build instead.
      '@vladmandic/face-api': '@vladmandic/face-api/dist/face-api.esm.js',
      // See src/lib/mediapipe-face-detection-stub.ts for why this is stubbed.
      '@mediapipe/face_detection': new URL('./src/lib/mediapipe-face-detection-stub.ts', import.meta.url).pathname,
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'student',
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
