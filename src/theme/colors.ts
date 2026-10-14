export const darkColors = {
  background: '#151E27',
  surface: '#1E2832',
  surfaceElevated: '#24303C',
  surfaceHighlight: '#2C3A48',
  primary: '#4FA3E3',
  primaryDark: '#3A8AC9',
  primaryLight: '#7BBDF0',
  secondary: '#4CAF80',
  accent: '#E8963D',
  text: '#FFFFFF',
  textSecondary: '#8394A6',
  textTertiary: '#5E6E7E',
  textInverse: '#151E27',
  border: '#2A3643',
  borderSubtle: '#1E2832',
  error: '#FF5252',
  warning: '#FFC107',
  success: '#4CAF80',
  mention: '#E8963D',
  link: '#6BBCFF',
  overlay: 'rgba(0,0,0,0.6)',
  messageBubbleOutgoing: '#2B5278',
  messageBubbleIncoming: '#1E2832',
  messageBubbleOutgoingText: '#FFFFFF',
  messageBubbleIncomingText: '#FFFFFF',
  inputBackground: '#1E2832',
  tabBar: '#1E2832',
  tabBarActive: '#4FA3E3',
  tabBarInactive: '#7D8B99',
  statusBar: 'dark' as const,
  unreadBadge: '#4FA3E3',
  onlineDot: '#4CAF80',
} as const;

export const lightColors = {
  background: '#F1F2F6',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#EDEFF2',
  primary: '#3390EC',
  primaryDark: '#2878C9',
  primaryLight: '#6DB1F5',
  secondary: '#2E9E5B',
  accent: '#E06B1F',
  text: '#000000',
  textSecondary: '#707579',
  textTertiary: '#A2A6AB',
  textInverse: '#FFFFFF',
  border: '#E4E6EA',
  borderSubtle: '#F1F2F6',
  error: '#D32F2F',
  warning: '#F57C00',
  success: '#2E9E5B',
  mention: '#E06B1F',
  link: '#2B7BE0',
  overlay: 'rgba(0,0,0,0.4)',
  messageBubbleOutgoing: '#E3FEE0',
  messageBubbleIncoming: '#FFFFFF',
  messageBubbleOutgoingText: '#000000',
  messageBubbleIncomingText: '#000000',
  inputBackground: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarActive: '#3390EC',
  tabBarInactive: '#8A8F94',
  statusBar: 'light' as const,
  unreadBadge: '#3390EC',
  onlineDot: '#2E9E5B',
} as const;

/**
 * ColorPalette uses widened string types so both darkColors and lightColors
 * satisfy the interface despite holding different literal hex values.
 */
export type ColorPalette = {
  [K in keyof typeof darkColors]: (typeof darkColors)[K] extends 'dark' | 'light'
    ? 'dark' | 'light'
    : string;
};

export type ColorKey = keyof ColorPalette;
