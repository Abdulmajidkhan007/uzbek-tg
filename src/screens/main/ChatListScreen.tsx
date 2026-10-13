/**
 * Chatlar ro'yxati (Telegram uslubi): sarlavhada ulanish holati, papka
 * tablari (TDLib chat folders), arxiv qatori, uzoq bosilganda amallar menyusi.
 * Arxiv ham shu komponent orqali ko'rsatiladi (ArchivedChatsScreen).
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@/hooks/useTheme';
import { useChatStore } from '@/stores/chat.store';
import type { Chat } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import {
  deleteChat,
  loadMoreChats,
  markChatRead,
  setChatArchived,
  setChatMuted,
  setChatPinned,
} from '@/services/tdlib/chats';
import type { ChatStackParamList } from '@/navigation/types';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';

import ChatListItem from '@/components/chat/ChatListItem';
import EmptyState from '@/components/common/EmptyState';

type Nav = StackNavigationProp<ChatStackParamList>;

const EMPTY: Chat[] = [];

function errorText(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/pinned/i.test(msg)) return "Qadalgan chatlar soni chegarasiga yetdingiz.";
  return msg;
}

// ---------------------------------------------------------------------------
// Uzoq bosish menyusi
// ---------------------------------------------------------------------------

function openChatMenu(chat: Chat, key: string): void {
  const run = (p: Promise<unknown>) =>
    p.catch((e) => showAlert('Xatolik', errorText(e)));

  const options = [
    {
      text: chat.isPinned ? 'Qadashni bekor qilish' : 'Qadash',
      icon: chat.isPinned ? 'pin-outline' : 'pin',
      onPress: () => void run(setChatPinned(chat.id, key, !chat.isPinned)),
    },
    {
      text: chat.isMuted ? 'Ovozni yoqish' : "Ovozsiz qilish",
      icon: chat.isMuted ? 'volume-high-outline' : 'volume-mute-outline',
      onPress: () => void run(setChatMuted(chat.id, !chat.isMuted)),
    },
  ];
  if (chat.unreadCount > 0 || chat.isMarkedUnread) {
    options.push({
      text: "O'qilgan deb belgilash",
      icon: 'checkmark-done-outline',
      onPress: () => void run(markChatRead(chat.id)),
    });
  }
  options.push({
    text: chat.isArchived ? 'Arxivdan chiqarish' : 'Arxivlash',
    icon: chat.isArchived ? 'arrow-undo-outline' : 'archive-outline',
    onPress: () => void run(setChatArchived(chat.id, !chat.isArchived)),
  });

  const isGroup = chat.type !== 'private';
  showActionSheet({
    title: chat.name,
    options: [
      ...options,
      {
        text: isGroup ? (chat.type === 'channel' ? 'Kanaldan chiqish' : 'Guruhdan chiqish') : "Chatni o'chirish",
        icon: isGroup ? 'exit-outline' : 'trash-outline',
        destructive: true,
        onPress: () =>
          showAlert(
            isGroup ? 'Chiqish' : "Chatni o'chirish",
            isGroup
              ? `"${chat.name}" dan chiqmoqchimisiz?`
              : `"${chat.name}" bilan yozishmalar sizda o'chiriladi.`,
            [
              { text: 'Bekor qilish', style: 'cancel' },
              {
                text: isGroup ? 'Chiqish' : "O'chirish",
                style: 'destructive',
                onPress: () => void run(deleteChat(chat.id)),
              },
            ],
          ),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Umumiy ro'yxat
// ---------------------------------------------------------------------------

interface ChatListBodyProps {
  /** 'main' | 'archive' | 'folder:<id>' */
  listKey: string;
  data: Chat[];
  header?: React.ReactElement | null;
  emptyText: string;
}

function ChatListBody({ listKey, data, header, emptyText }: ChatListBodyProps): React.JSX.Element {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const isLoading = useChatStore((s) => s.isLoadingChats);
  const [refreshing, setRefreshing] = useState(false);

  const handlePress = useCallback(
    (chatId: string) => {
      const chat = data.find((c) => c.id === chatId);
      if (!chat) return;
      navigation.navigate('ChatDetail', {
        chatId: chat.id,
        chatType: chat.type,
        title: chat.name,
        avatarUrl: chat.avatarUrl,
      });
    },
    [data, navigation],
  );

  const handleLongPress = useCallback(
    (chatId: string) => {
      const chat = data.find((c) => c.id === chatId);
      if (!chat) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      openChatMenu(chat, listKey);
    },
    [data, listKey],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMoreChats(listKey);
    } finally {
      setRefreshing(false);
    }
  }, [listKey]);

  return (
    <FlashList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ChatListItem chat={item} onPress={handlePress} onLongPress={handleLongPress} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        isLoading && data.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 60 }} color={theme.colors.primary} />
        ) : (
          <EmptyState icon="💬" title="Chatlar yo'q" subtitle={emptyText} />
        )
      }
      onEndReached={() => void loadMoreChats(listKey)}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }
      contentContainerStyle={{ paddingBottom: 120 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Arxiv qatori (asosiy ro'yxat tepasida)
// ---------------------------------------------------------------------------

function ArchiveRow({ chats, onPress }: { chats: Chat[]; onPress: () => void }): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const unread = chats.reduce((n, x) => n + (x.unreadCount > 0 ? 1 : 0), 0);
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: c.surfaceHighlight }}
      style={[styles.archiveRow, { backgroundColor: c.background }]}
    >
      <View style={[styles.archiveAvatar, { backgroundColor: c.textTertiary }]}>
        <Ionicons name="archive" size={24} color="#FFFFFF" />
      </View>
      <View style={[styles.archiveContent, { borderBottomColor: c.border }]}>
        <Text style={[styles.archiveTitle, { color: c.text }]}>Arxiv</Text>
        <Text style={{ color: c.textSecondary, fontSize: 15 }} numberOfLines={1}>
          {chats
            .slice(0, 8)
            .map((x) => x.name)
            .join(', ')}
        </Text>
      </View>
      {unread > 0 ? (
        <View style={[styles.archiveBadge, { backgroundColor: c.textTertiary }]}>
          <Text style={styles.archiveBadgeText}>{unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Asosiy ekran
// ---------------------------------------------------------------------------

const CONNECTION_TEXT = {
  connecting: 'Ulanmoqda...',
  updating: 'Yangilanmoqda...',
  waitingForNetwork: 'Tarmoq kutilmoqda...',
} as const;

type Props = StackScreenProps<ChatStackParamList, 'ChatList'>;

export function ChatListScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const chats = useChatStore((s) => s.chats);
  const folders = useChatStore((s) => s.folders);
  const listChats = useChatStore((s) => s.listChats);
  const connection = useAuthStore((s) => s.connection);
  const [active, setActive] = useState('main');

  const archive = listChats.archive ?? EMPTY;
  const data = active === 'main' ? chats : listChats[active] ?? EMPTY;
  const allUnread = useMemo(() => chats.filter((x) => x.unreadCount > 0 && !x.isMuted).length, [chats]);

  const tabs = useMemo(
    () => [
      { key: 'main', name: 'Barcha chatlar', unread: allUnread },
      ...folders.map((f) => ({ key: `folder:${f.id}`, name: f.name, unread: f.unreadCount })),
    ],
    [folders, allUnread],
  );

  const archiveHeader =
    active === 'main' && archive.length > 0 ? (
      <ArchiveRow chats={archive} onPress={() => navigation.navigate('ArchivedChats')} />
    ) : null;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: c.surface }]}>
        <View style={styles.titleRow}>
          {connection !== 'ready' ? (
            <ActivityIndicator size="small" color={c.textSecondary} style={{ marginRight: 10 }} />
          ) : null}
          <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
            {connection === 'ready' ? 'Uzbek TG' : CONNECTION_TEXT[connection]}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Search')}
          style={styles.headerIcon}
          accessibilityRole="button"
          accessibilityLabel="Qidirish"
        >
          <Ionicons name="search" size={23} color={c.text} />
        </TouchableOpacity>
      </View>

      {folders.length > 0 ? (
        <View style={[styles.tabsWrap, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {tabs.map((t) => {
              const on = t.key === active;
              return (
                <Pressable key={t.key} onPress={() => setActive(t.key)} style={styles.tab}>
                  <View style={styles.tabInner}>
                    <Text style={[styles.tabText, { color: on ? c.primary : c.textSecondary }]}>{t.name}</Text>
                    {t.unread > 0 ? (
                      <View style={[styles.tabBadge, { backgroundColor: on ? c.primary : c.textTertiary }]}>
                        <Text style={styles.tabBadgeText}>{t.unread}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[styles.tabLine, { backgroundColor: on ? c.primary : 'transparent' }]} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ChatListBody
        key={active}
        listKey={active}
        data={data}
        header={archiveHeader}
        emptyText={active === 'main' ? 'Yangi suhbat boshlash uchun qalam tugmasini bosing.' : "Bu papkada chat yo'q."}
      />

      <TouchableOpacity
        onPress={() => navigation.getParent()?.navigate('ContactsTab')}
        style={[styles.fab, { backgroundColor: c.primary }, theme.shadows.md]}
        accessibilityRole="button"
        accessibilityLabel="Yangi xabar"
        activeOpacity={0.85}
      >
        <Ionicons name="pencil" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

type ArchiveProps = StackScreenProps<ChatStackParamList, 'ArchivedChats'>;

export function ArchivedChatsScreen({ navigation }: ArchiveProps): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const archive = useChatStore((s) => s.listChats.archive ?? EMPTY);
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: c.surface }]}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Orqaga">
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>Arxiv</Text>
        </View>
      </View>
      <ChatListBody listKey="archive" data={archive} emptyText="Arxivlangan chatlar shu yerda turadi." />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { fontSize: 21, fontWeight: '700' },
  headerIcon: { padding: 6 },
  back: { paddingRight: 18, paddingVertical: 6 },
  tabsWrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabs: { paddingHorizontal: 6 },
  tab: { paddingHorizontal: 12, paddingTop: 8 },
  tabInner: { flexDirection: 'row', alignItems: 'center', paddingBottom: 9 },
  tabText: { fontSize: 15, fontWeight: '600' },
  tabBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  tabLine: { height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, height: 72 },
  archiveAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  archiveContent: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingRight: 50,
  },
  archiveTitle: { fontSize: 16.5, fontWeight: '600', marginBottom: 3 },
  archiveBadge: {
    position: 'absolute',
    right: 14,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveBadgeText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 96,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
