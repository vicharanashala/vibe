module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^shared/(.*)$': '<rootDir>/src/shared/$1', // Resolve shared path in Jest
    '^modules/(.*)$': '<rootDir>/src/modules/$1', // Resolve modules path if used
  },
};
