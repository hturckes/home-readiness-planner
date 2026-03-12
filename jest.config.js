// jest.config.js
// Uses next/jest (SWC-based) so no separate babel or ts-jest setup is needed.
// The next/jest helper also auto-wires the @/ path alias from tsconfig.json.

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Path to your Next.js app — resolves next.config.ts and tsconfig.json
  dir: './',
});

/** @type {import('jest').Config} */
const customConfig = {
  // Pure calculation functions have no DOM dependency
  testEnvironment: 'node',
};

module.exports = createJestConfig(customConfig);
