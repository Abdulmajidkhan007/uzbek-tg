import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import { RootNavigator } from '@/navigation/RootNavigator';
import { DialogHost } from '@/components/ui/Dialog';
import { initAuthStore, useAuthStore } from '@/stores/auth.store';
import { initUIStore } from '@/stores/ui.store';
import { useUIStore } from '@/stores/ui.store';
import { darkTheme, lightTheme } from '@/theme';
import { useColorScheme } from 'react-native';

function AppContent(): React.JSX.Element {
  const themeMode = useUIStore((s) => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme !== 'light');
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <NavigationContainer
      theme={{
        dark: isDark,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.unreadBadge,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App(): React.JSX.Element {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      await Promise.all([initAuthStore(), initUIStore()]);
      setIsReady(true);
    }
    bootstrap();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F1923', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#3D9AE8" size="large" />
      </View>
    );
  }

  return <AppShell />;
}

function AppShell(): React.JSX.Element {
  const startError = useAuthStore((s) => s.startError);
  if (startError) {
    return <StartErrorScreen error={startError} />;
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppContent />
        <DialogHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** TDLib ishga tushmasa (kalit yo'q yoki native kutubxona yo'q) — sababni ko'rsatadi. */
function StartErrorScreen({ error }: { error: string }): React.JSX.Element {
  const text =
    error === 'NO_API_KEYS'
      ? "Bu APK Telegram API kalitlarisiz yig'ilgan (TG_API_ID / TG_API_HASH). " +
        "GitHub → Settings → Secrets → Actions'ga qo'shib, APK'ni qayta yig'ing."
      : `Telegram kutubxonasi ishga tushmadi:\n${error}`;
  return (
    <View style={{ flex: 1, backgroundColor: '#0F1923', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
        Ulanib bo'lmadi
      </Text>
      <Text style={{ color: '#B0BEC5', fontSize: 15, lineHeight: 22 }}>{text}</Text>
    </View>
  );
}
