import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import { RootNavigator } from '@/navigation/RootNavigator';
import { DialogHost } from '@/components/ui/Dialog';
import { ThemeRevealHost } from '@/components/ui/ThemeReveal';
import { useTheme } from '@/hooks/useTheme';
import { initAuthStore, useAuthStore } from '@/stores/auth.store';
import { initUIStore } from '@/stores/ui.store';
import { useT } from '@/i18n';
import { useChatStore } from '@/stores/chat.store';
import { td } from '@/services/tdlib/client';
import { startNotifications, stopNotifications, consumeLaunchChat } from '@/services/notifications';
import { onOpenChatFromNotification } from '@/services/native';
import { startNetworkSync, startStoragePolicy } from '@/services/tdlib/storage';
import { startStories, stopStories } from '@/services/tdlib/stories';
import type { RootStackParamList } from '@/navigation/types';

const navRef = createNavigationContainerRef<RootStackParamList>();

/** Bildirishnoma bosilganda chatni ochadi. */
async function openChatFromNotification(chatId: string): Promise<void> {
  const chat = useChatStore.getState().chats.find((c) => c.id === chatId);
  let params = chat
    ? { chatId, chatType: chat.type, title: chat.name, avatarUrl: chat.avatarUrl }
    : null;
  if (!params) {
    const c = await td<{ '@type': string; title: string; type: { '@type': string; is_channel?: boolean } }>({
      '@type': 'getChat',
      chat_id: Number(chatId),
    }).catch(() => null);
    if (!c) return;
    const type =
      c.type['@type'] === 'chatTypeSupergroup'
        ? c.type.is_channel
          ? 'channel'
          : 'group'
        : c.type['@type'] === 'chatTypeBasicGroup'
        ? 'group'
        : 'private';
    params = { chatId, chatType: type, title: c.title, avatarUrl: undefined };
  }
  const go = () =>
    navRef.navigate('Main', { screen: 'ChatsTab', params: { screen: 'ChatDetail', initial: false, params } });
  if (navRef.isReady()) go();
  else setTimeout(go, 800);
}

/** Avtorizatsiyadan keyin ishga tushadigan fon xizmatlari. */
function useSessionServices(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    if (!isAuthenticated) return;
    startNotifications();
    startNetworkSync();
    startStoragePolicy();
    startStories();
    void consumeLaunchChat().then((chatId) => {
      if (chatId) void openChatFromNotification(chatId);
    });
    const off = onOpenChatFromNotification((id) => void openChatFromNotification(id));
    return () => {
      off();
      stopNotifications();
      stopStories();
    };
  }, [isAuthenticated]);
}

function AppContent(): React.JSX.Element {
  const theme = useTheme();
  const isDark = theme.isDark;
  useSessionServices();

  return (
    <NavigationContainer
      ref={navRef}
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
        <ThemeRevealHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** TDLib ishga tushmasa (kalit yo'q yoki native kutubxona yo'q) — sababni ko'rsatadi. */
function StartErrorScreen({ error }: { error: string }): React.JSX.Element {
  const t = useT();
  const text = error === 'NO_API_KEYS' ? t('main.startError.noKeys') : t('main.startError.tdlib', { error });
  return (
    <View style={{ flex: 1, backgroundColor: '#0F1923', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
        {t('main.startError.title')}
      </Text>
      <Text style={{ color: '#B0BEC5', fontSize: 15, lineHeight: 22 }}>{text}</Text>
    </View>
  );
}
