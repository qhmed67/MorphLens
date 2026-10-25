module.exports = {
  preset: 'jest-expo',
  // Reanimated/Worklets ship a jest resolver that prefers their web build.
  resolver: '<rootDir>/jest.resolver.js',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: ['src/engine/**/*.ts', '!src/engine/bridge/**'],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 85,
      functions: 85,
      lines: 85,
    },
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // The icon library ships ESM only; without this the QA sweep cannot import
  // any screen that renders an icon. The jest-expo patterns are kept and
  // `lucide-react-native` is added to the allow-list.
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|lucide-react-native))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
};
