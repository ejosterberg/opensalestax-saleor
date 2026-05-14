/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    // Stage 03 gate: branch ≥70 for transformers+client; lines ≥80 overall.
    // Functions threshold relaxed because handler factories produce
    // callbacks invoked by the SDK after JWT verification — those paths
    // are covered by the live demo (stage 05), not the unit suite.
    global: {
      branches: 70,
      functions: 60,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
};
