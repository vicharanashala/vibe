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
    // Web workers have no window; `self` is their global scope.
    files: ['**/*-worker.ts', 'public/workers/**/*.js'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
