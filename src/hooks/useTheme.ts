import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type AppTheme } from '@/theme';
import { ACCENTS } from '@/theme/accents';
import { useUIStore } from '@/stores/ui.store';

/** Joriy mavzu: qorong'i/yorug' + tanlangan asosiy rang. */
export function useTheme(): AppTheme {
  const systemScheme = useColorScheme();
  const themeMode = useUIStore((s) => s.themeMode);
  const accent = useUIStore((s) => s.accent);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');

  return useMemo(() => {
    const base = isDark ? darkTheme : lightTheme;
    if (accent === 'blue') return base;
    const a = ACCENTS[accent];
    const main = isDark ? a.dark : a.light;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: main,
        tabBarActive: main,
        unreadBadge: main,
        link: main,
        messageBubbleOutgoing: isDark ? a.bubbleDark : a.bubbleLight,
      },
    };
  }, [isDark, accent]);
}
