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
    name: 'backend-integration',
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    include: [resolve(__dirname, 'integration/**/*.api.test.ts')],
    setupFiles: [resolve(__dirname, 'helpers/setup.integration.ts')],
    hookTimeout: 60000,
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: resolve(__dirname, '../coverage/integration'),
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/index.ts',
        'src/**/types/**',
        'src/**/*.d.ts',
        'src/**/openapi/**',
        'scripts/**',
        'src/**/tests/**',
      ],
    },
  },
});
