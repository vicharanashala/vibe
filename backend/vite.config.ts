import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc'
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    tsconfigPaths(),   // ← picks up your tsconfig.json “paths” mappings
    // This is required to build the test files with SWC
    swc.vite({
      sourceMaps: true,

      jsc: {
        target: "es2022",
        externalHelpers: true,
        keepClassNames: true,
        parser: {
          syntax: "typescript",
          tsx: true,
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          useDefineForClassFields: false,
          legacyDecorator: true,
          decoratorMetadata: true
        }
      },
      module: {
        type: "es6",
        strictMode: true,
        lazy: false,
        noInterop: false
      },
      isModule: true
    })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/pipeline/**'],
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],
    },
  }
});
