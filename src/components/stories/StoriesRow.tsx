/**
 * Chatlar ro'yxati tepasidagi hikoyalar qatori (Telegram uslubi):
 * birinchi — "Mening hikoyam" (+ belgisi bilan), keyin faol hikoyasi bor chatlar.
 * Shuningdek sarlavhadagi kichik avatarlar (ro'yxat pastga aylantirilganda).
 */
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT, t } from '@/i18n';
import { useStoriesStore, type StoryChat } from '@/stores/stories.store';
import { useAuthStore } from '@/stores/auth.store';
import { onStoryPostResult } from '@/services/tdlib/stories';
import { showAlert } from '@/components/ui/Dialog';
import type { ChatStackParamList } from '@/navigation/types';
import Avatar from '@/components/common/Avatar';
import StoryAvatar, { STORY_GRADIENT } from './StoryAvatar';
import { openAddStorySheet } from './addStory';

type Nav = StackNavigationProp<ChatStackParamList>;

export const STORIES_ROW_HEIGHT = 98;
const AVATAR = 58;

/** Joylash xatosini ko'rsatadi (ChatListScreen'da bir marta chaqiriladi). */
export function useStoryPostAlerts(): void {
  useEffect(
    () =>
      onStoryPostResult((r) => {
        if (!r.ok) showAlert(t('stories.postFailed'), r.message);
      }),
    [],
  );
}

function Item({
  chat,
  name,
  onPress,
  onLongPress,
  own,
  posting,
}: {
  chat: StoryChat | null;
  name: string;
  onPress: () => void;
  onLongPress?: () => void;
  own?: { avatarUri?: string; ownerName: string };
  posting?: boolean;
}): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const ring = chat ? (chat.hasUnread ? 'unread' : 'read') : 'none';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.item}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      <View>
        <StoryAvatar
          uri={own ? own.avatarUri : chat?.avatarUri}
          name={own ? own.ownerName : name}
          size={AVATAR}
          ring={ring}
          gradientId={`sr${chat?.chatId ?? 'own'}`}
        />
        {own ? (
          <View style={[styles.plus, { backgroundColor: c.primary, borderColor: theme.isDark ? c.background : c.surface }]}>
            {posting ? (
              <ActivityIndicator size={10} color="#FFFFFF" />
            ) : (
              <Ionicons name="add" size={14} color="#FFFFFF" />
            )}
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.name, { color: chat?.hasUnread || own ? c.text : c.textSecondary }]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </Pressable>
  );
}

export function StoriesRow(): React.JSX.Element {
  const tr = useT();
  const navigation = useNavigation<Nav>();
  const main = useStoriesStore((s) => s.main);
  const own = useStoriesStore((s) => s.own);
  const posting = useStoriesStore((s) => s.posting);
  const me = useAuthStore((s) => s.currentUser);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={{ height: STORIES_ROW_HEIGHT }}
    >
      <Item
        chat={own}
        name={posting > 0 ? tr('stories.posting') : tr('stories.myStory')}
        own={{ avatarUri: me?.avatarUrl, ownerName: me?.firstName ?? '' }}
        posting={posting > 0}
        onPress={() => {
          if (own) navigation.navigate('StoryViewer', { chatId: own.chatId });
          else openAddStorySheet();
        }}
        onLongPress={openAddStorySheet}
      />
      {main.map((chat) => (
        <Item
          key={chat.chatId}
          chat={chat}
          name={chat.name}
          onPress={() => navigation.navigate('StoryViewer', { chatId: chat.chatId })}
        />
      ))}
    </ScrollView>
  );
}

/** Sarlavhadagi 3 tagacha ustma-ust kichik avatar (qator yig'ilganda). */
export function StoriesHeaderAvatars({ onPress }: { onPress: (chatId: string) => void }): React.JSX.Element | null {
  const theme = useTheme();
  const tr = useT();
  const main = useStoriesStore((s) => s.main);
  const shown = main.slice(0, 3);
  if (shown.length === 0) return null;
  const bg = theme.colors.surface;
  return (
    <Pressable
      onPress={() => onPress(shown[0]!.chatId)}
      style={styles.mini}
      accessibilityRole="button"
      accessibilityLabel={tr('stories.open')}
      hitSlop={6}
    >
      {shown.map((chat, i) => (
        <View
          key={chat.chatId}
          style={[
            styles.miniItem,
            {
              marginLeft: i === 0 ? 0 : -10,
              zIndex: 3 - i,
              borderColor: chat.hasUnread ? STORY_GRADIENT[0] : theme.colors.textTertiary,
              backgroundColor: bg,
            },
          ]}
        >
          <Avatar uri={chat.avatarUri} name={chat.name || '?'} size={24} />
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 6, alignItems: 'center' },
  item: { width: 76, alignItems: 'center', paddingTop: 6 },
  name: { fontSize: 12, marginTop: 4, maxWidth: 72, textAlign: 'center' },
  plus: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mini: { flexDirection: 'row', alignItems: 'center', marginRight: 10 },
  miniItem: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
