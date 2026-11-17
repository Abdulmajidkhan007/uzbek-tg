const reactNative = require('@react-native/eslint-config/flat');

module.exports = [
  ...reactNative,
  { ignores: ['node_modules/', 'android/', 'dist/', 'coverage/'] },
];
