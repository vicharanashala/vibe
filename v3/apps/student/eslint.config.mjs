import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {},
  },
  {
    // Web workers and the service worker have no window; `self` is their global scope.
    files: ['**/*-worker.ts', 'public/workers/**/*.js', 'public/sw.js'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
