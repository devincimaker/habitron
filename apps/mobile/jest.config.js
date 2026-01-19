module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@sentry/react-native|@sentry/core)/)',
  ],
  moduleNameMapper: {
    '^@habits-coach/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@sentry/react-native$': '<rootDir>/__mocks__/@sentry/react-native.ts',
  },
  collectCoverageFrom: [
    'utils/**/*.ts',
    '!**/*.d.ts',
  ],
};
