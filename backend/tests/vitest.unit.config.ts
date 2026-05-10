import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: [resolve(__dirname, 'tsconfig.json')] }),
    swc.vite({
      sourceMaps: true,
      jsc: {
        target: 'es2022',
        externalHelpers: true,
        keepClassNames: true,
        parser: { syntax: 'typescript', tsx: true, decorators: true, dynamicImport: true },
        transform: { useDefineForClassFields: false, legacyDecorator: true, decoratorMetadata: true },
      },
      module: { type: 'es6', strictMode: true, lazy: false, noInterop: false },
      isModule: true,
    }),
  ],
  test: {
    name: 'backend-unit',
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    include: [resolve(__dirname, 'unit/**/*.unit.test.ts')],
    setupFiles: [resolve(__dirname, 'helpers/setup.unit.ts')],
    hookTimeout: 10000,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: resolve(__dirname, '../coverage/unit'),
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/index.ts',
        'src/**/types/**',
        'src/**/*.d.ts',
        'src/**/*.dto.ts',
        'src/**/openapi/**',
        'scripts/**',
        'src/**/tests/**',
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
