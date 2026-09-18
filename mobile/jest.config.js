module.exports = {
  preset: '@react-native/jest-preset',
  // Several dependencies ship untranspiled ESM, which Jest cannot parse
  // without running them through Babel first. Without this the suite failed
  // to even load App.tsx - it had been red since the app was scaffolded,
  // invisible because nothing ever ran it. The package name is matched with
  // a trailing [^/]* so scoped packages that merely start with the prefix
  // (@react-native-async-storage) are covered too, and the separator class
  // allows a backslash because the paths are Windows paths here.
  transformIgnorePatterns: [
    'node_modules[/\\\\](?!(?:@react-native|@react-navigation|react-native)[^/\\\\]*[/\\\\])',
  ],
  // SVGs are imported as components through react-native-svg-transformer in
  // Metro; Jest has no such transformer, so they are stubbed.
  moduleNameMapper: {
    '\\.svg$': '<rootDir>/jest/svgMock.js',
  },
};
