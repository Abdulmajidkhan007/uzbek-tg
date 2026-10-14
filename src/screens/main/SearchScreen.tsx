/**
 * Global qidiruv (Telegram uslubi): "Chatlar" va "Xabarlar" tablari.
 * Chatlar — TDLib searchChats (lokal + ommaviy), xabarlar — searchMessages.
 * Yaqinda qidirilganlar faqat shu sessiya davomida saqlanadi.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from '@/utils/haptics';

import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import { formatChatTime } from '@/components/chat/ChatListItem';
import { chatName, searchChats, searchMessages } from '@/services/tdlib/chats';
import { useChatStore } from '@/stores/chat.store';
import { useAuthStore } from '@/stores/auth.store';
import type { ChatStackParamList } from '@/navigation/types';
import type { Chat, ChatMessage } from '@/stores/chat.store';

type NavProp = StackNavigationProp<ChatStackParamList>;
type Tab = 'chats' | 'messages';

// Sessiya davomida eslab qolinadigan so'nggi qidiruvlar.
let recentMemory: string[] = [];

export function SearchScreen(): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const inputRef = useRef<TextInput>(null);
  const myId = useAuthStore((s) => s.currentUser?.id);

  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('chats');
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recent, setRecent] = useState<string[]>(recentMemory);

  const q = query.trim();
  const hasQuery = q.length >= 2;

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setChats([]);
      setMessages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.all([searchChats(q).catch(() => []), searchMessages(q).catch(() => [])])
        .then(([foundChats, foundMessages]) => {
          if (cancelled) return;
          setChats(foundChats);
          setMessages(foundMessages);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, hasQuery]);

  const remember = useCallback((term: string) => {
    recentMemory = [term, ...recentMemory.filter((s) => s !== term)].slice(0, 8);
    setRecent(recentMemory);
  }, []);

  const removeRecent = useCallback((term: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    recentMemory = recentMemory.filter((s) => s !== term);
    setRecent(recentMemory);
  }, []);

  const isSaved = (chat: Chat) => chat.type === 'private' && myId != null && chat.otherUser?.id === myId;
  const titleOf = (chat: Chat) => (isSaved(chat) ? t('main.savedMessages') : chat.name);

  const openChat = (chat: Chat) => {
    remember(q);
    navigation.navigate('ChatDetail', {
      chatId: chat.id,
      chatType: chat.type,
      title: titleOf(chat),
      avatarUrl: chat.avatarUrl,
    });
  };

  const openMessage = (m: ChatMessage) => {
    remember(q);
    const chat = useChatStore.getState().chats.find((x) => x.id === m.chatId);
    navigation.navigate('ChatDetail', {
      chatId: m.chatId,
      chatType: chat?.type ?? 'group',
      title: chat ? titleOf(chat) : chatName(m.chatId) || t('main.search.unknownChat'),
      avatarUrl: chat?.avatarUrl,
    });
  };

  const chatSubtitle = (chat: Chat): string => {
    if (chat.type === 'channel') {
      return chat.memberCount ? t.p('main.search.subscribers', chat.memberCount) : t('main.search.channel');
    }
    if (chat.type === 'group' || chat.type === 'topic_group') {
      return chat.memberCount ? t.p('main.search.members', chat.memberCount) : t('main.search.group');
    }
    if (chat.otherUser?.username) return `@${chat.otherUser.username}`;
    return '';
  };

  const renderChat = ({ item }: { item: Chat }) => {
    const saved = isSaved(item);
    const sub = chatSubtitle(item);
    return (
      <Pressable
        onPress={() => openChat(item)}
        android_ripple={{ color: c.surfaceHighlight }}
        style={styles.row}
        accessibilityRole="button"
      >
        {saved ? (
          <View style={[styles.savedAvatar, { backgroundColor: c.primary }]}>
            <Ionicons name="bookmark" size={20} color="#FFFFFF" />
          </View>
        ) : (
          <Avatar uri={item.avatarUrl ?? item.otherUser?.avatarUrl} name={item.name} size={46} />
        )}
        <View style={[styles.rowBody, { borderBottomColor: c.border }]}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {titleOf(item)}
          </Text>
          {sub ? (
            <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const chat = useChatStore.getState().chats.find((x) => x.id === item.chatId);
    const name = chat ? titleOf(chat) : chatName(item.chatId) || t('main.search.unknownChat');
    const text = item.previewText ?? item.text ?? t('main.search.media');
    const own = item.senderId === 'me';
    return (
      <Pressable
        onPress={() => openMessage(item)}
        android_ripple={{ color: c.surfaceHighlight }}
        style={styles.row}
        accessibilityRole="button"
      >
        <Avatar uri={chat?.avatarUrl ?? item.senderPreview.avatarUrl} name={name} size={46} />
        <View style={[styles.rowBody, { borderBottomColor: c.border }]}>
          <View style={styles.msgTop}>
            <Text style={[styles.name, { color: c.text, flex: 1 }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.time, { color: c.textSecondary }]}>{formatChatTime(item.sentAt, t.lang)}</Text>
          </View>
          <Text style={[styles.sub, { color: c.textSecondary }]} numberOfLines={1}>
            {own ? <Text style={{ color: c.text }}>{t('main.you')}: </Text> : null}
            {text}
          </Text>
        </View>
      </Pressable>
    );
  };

  const listBg = theme.isDark ? c.background : c.surface;
  const empty = tab === 'chats' ? chats.length === 0 : messages.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: listBg, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: c.surface }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.back} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: c.text }]}
          value={query}
          onChangeText={setQuery}
          placeholder={t('main.search.placeholder')}
          placeholderTextColor={c.textTertiary}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.clear} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={22} color={c.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.tabs, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        {(['chats', 'messages'] as Tab[]).map((k) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} style={styles.tab} accessibilityRole="tab">
              <Text style={[styles.tabText, { color: on ? c.primary : c.textSecondary }]}>
                {k === 'chats' ? t('main.search.chats') : t('main.search.messages')}
              </Text>
              <View style={[styles.tabLine, { backgroundColor: on ? c.primary : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      {!hasQuery ? (
        recent.length > 0 ? (
          <View>
            <Text style={[styles.sectionTitle, { color: c.primary }]}>{t('main.search.recent')}</Text>
            {recent.map((term) => (
              <Pressable
                key={term}
                onPress={() => setQuery(term)}
                android_ripple={{ color: c.surfaceHighlight }}
                style={styles.recentRow}
              >
                <Ionicons name="time-outline" size={20} color={c.textSecondary} />
                <Text style={[styles.recentText, { color: c.text }]} numberOfLines={1}>
                  {term}
                </Text>
                <Pressable onPress={() => removeRecent(term)} hitSlop={10} accessibilityLabel={t('common.delete')}>
                  <Ionicons name="close" size={18} color={c.textTertiary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.hint}>
            <Ionicons name="search" size={48} color={c.textTertiary} />
            <Text style={[styles.hintText, { color: c.textSecondary }]}>{t('main.search.hint')}</Text>
          </View>
        )
      ) : loading && empty ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      ) : empty ? (
        <View style={{ paddingTop: 40 }}>
          <EmptyState icon="🔍" title={t('main.search.noResults')} subtitle={t('main.search.noResultsSub', { q })} />
        </View>
      ) : tab === 'chats' ? (
        <FlatList
          data={chats}
          keyExtractor={(x) => x.id}
          renderItem={renderChat}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(m, i) => `${m.chatId}-${m.id}-${i}`}
          renderItem={renderMessage}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  back: { paddingRight: 16 },
  input: { flex: 1, fontSize: 18, paddingVertical: 0 },
  clear: { paddingLeft: 10 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingTop: 10 },
  tabText: { fontSize: 15, fontWeight: '600', paddingBottom: 9 },
  tabLine: { height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, height: 66 },
  rowBody: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    marginLeft: 14,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  savedAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 14.5, marginTop: 2 },
  msgTop: { flexDirection: 'row', alignItems: 'center' },
  time: { fontSize: 13, marginLeft: 8 },
  sectionTitle: { fontSize: 14.5, fontWeight: '600', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, height: 48 },
  recentText: { flex: 1, fontSize: 16, marginLeft: 16 },
  hint: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  hintText: { fontSize: 15, textAlign: 'center', marginTop: 14, lineHeight: 21 },
});
