module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // '@/x' -> './src/x' (tsconfig paths alias'ining Metro uchun nusxasi).
    ['module-resolver', { root: ['.'], alias: { '@': './src' } }],
    // Reanimated 4 worklet'lari uchun — ro'yxatda oxirgi bo'lishi shart.
    'react-native-worklets/plugin',
  ],
};
