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
    name: 'frontend-unit',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    include: [resolve(__dirname, 'unit/**/*.unit.test.{ts,tsx}')],
    setupFiles: [resolve(__dirname, 'vitest.setup.ts')],
    css: false,
    hookTimeout: 10000,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: resolve(__dirname, '../coverage/unit'),
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/index.ts',
        'src/**/index.tsx',
        'src/**/*.d.ts',
        'src/types/**',
        'src/lib/api/schema.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.stories.{ts,tsx}',
      ],
      thresholds: {
        lines: 70,
        functions: 75,
        branches: 65,
        statements: 70,
      },
    },
  },
});
