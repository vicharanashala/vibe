import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '@tests': resolve(__dirname),
    },
  },
  test: {
    name: 'frontend-integration',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    include: [resolve(__dirname, 'integration/**/*.integration.test.{ts,tsx}')],
    setupFiles: [resolve(__dirname, 'vitest.setup.ts'), resolve(__dirname, 'helpers/mockApi/setup.ts')],
    css: false,
    hookTimeout: 30000,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: resolve(__dirname, '../coverage/integration'),
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/index.ts',
        'src/**/index.tsx',
        'src/**/*.d.ts',
        'src/types/**',
        'src/lib/api/schema.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
});
