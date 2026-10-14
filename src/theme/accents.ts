import type { AccentKey } from '@/stores/ui.store';

/** Telegram'dagi kabi asosiy rang variantlari (qorong'i / yorug' mavzu uchun). */
export const ACCENTS: Record<
  AccentKey,
  { dark: string; light: string; bubbleDark: string; bubbleLight: string; bubbleLightText?: string }
> = {
  blue: { dark: '#4FA3E3', light: '#3390EC', bubbleDark: '#2B5278', bubbleLight: '#E3FEE0' },
  green: { dark: '#5DBB6B', light: '#3FA84F', bubbleDark: '#2E5A3A', bubbleLight: '#DCF8C6' },
  orange: { dark: '#F0A04B', light: '#E68A1E', bubbleDark: '#6B4A23', bubbleLight: '#FFF0D9' },
  red: { dark: '#E86B6B', light: '#E0484E', bubbleDark: '#6A2E33', bubbleLight: '#FFE1E1' },
  purple: { dark: '#A07CE8', light: '#8A5CDB', bubbleDark: '#4A3A72', bubbleLight: '#EDE3FF' },
  teal: { dark: '#3CC2C2', light: '#1BA5A8', bubbleDark: '#1F5A5D', bubbleLight: '#D9F7F5' },
  pink: { dark: '#E86FA8', light: '#D9488C', bubbleDark: '#6A2E4C', bubbleLight: '#FFE0EF' },
};

export const ACCENT_ORDER: AccentKey[] = ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'pink'];
