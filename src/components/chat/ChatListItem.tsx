/**
 * Chat ro'yxatidagi bitta qator (Telegram uslubi): avatar, nom + ovozsiz
 * belgisi, holat belgilari va vaqt; pastda yuboruvchi + oldindan ko'rinish,
 * o'qilmaganlar soni yoki qadalgan belgisi.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, isToday, isThisWeek, isThisYear } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import type { Chat } from '@/stores/chat.store';

export interface ChatListItemProps {
  chat: Chat;
  onPress: (chatId: string) => void;
  onLongPress?: (chatId: string) => void;
  currentUserId?: string;
}

const WEEKDAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

export function formatChatTime(date: Date): string {
  if (date.getTime() === 0) return '';
  if (isToday(date)) return format(date, 'HH:mm');
  if (isThisWeek(date, { weekStartsOn: 1 })) return WEEKDAYS[date.getDay()] ?? '';
  if (isThisYear(date)) return `${date.getDate()}-${MONTHS[date.getMonth()]}`;
  return format(date, 'dd.MM.yy');
}

const ChatListItem = React.memo(function ChatListItem({
  chat,
  onPress,
  onLongPress,
  currentUserId = 'me',
}: ChatListItemProps) {
  const theme = useTheme();
  const c = theme.colors;

  const handlePress = useCallback(() => onPress(chat.id), [onPress, chat.id]);
  const handleLongPress = useCallback(() => onLongPress?.(chat.id), [onLongPress, chat.id]);

  const msg = chat.lastMessage;
  const isOwn = msg != null && msg.senderId === currentUserId;
  const isGroup = chat.type === 'group' || chat.type === 'topic_group';

  let prefix = '';
  if (msg && !chat.isTyping) {
    if (isOwn && chat.type !== 'channel') prefix = 'Siz';
    else if (isGroup && msg.senderPreview.firstName) prefix = msg.senderPreview.firstName;
  }
  const preview = chat.isTyping
    ? `${chat.typingUserName ?? 'yozmoqda'}...`
    : msg
    ? msg.previewText ?? msg.text ?? ''
    : '';

  const unread = chat.unreadCount > 0 || chat.isMarkedUnread;
  const avatarUri = chat.avatarUrl ?? chat.otherUser?.avatarUrl;

  let tick: string | null = null;
  if (isOwn && msg && chat.type !== 'channel') {
    if (msg.status === 'sending') tick = 'time-outline';
    else if (msg.status === 'failed') tick = 'alert-circle';
    else if (msg.status === 'read') tick = 'checkmark-done';
    else tick = 'checkmark';
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      android_ripple={{ color: c.surfaceHighlight }}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: c.background },
        pressed && { backgroundColor: c.surfaceHighlight },
      ]}
      accessibilityRole="button"
      accessibilityLabel={chat.name}
    >
      <Avatar
        uri={avatarUri}
        name={chat.name}
        size={54}
        showOnline={chat.type === 'private'}
        isOnline={chat.isOnline}
        style={styles.avatar}
      />

      <View style={[styles.content, { borderBottomColor: c.border }]}>
        <View style={styles.topRow}>
          {chat.type === 'channel' ? (
            <Ionicons name="megaphone" size={14} color={c.text} style={styles.typeIcon} />
          ) : isGroup ? (
            <Ionicons name="people" size={15} color={c.text} style={styles.typeIcon} />
          ) : null}
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {chat.name}
          </Text>
          {chat.isMuted ? (
            <Ionicons name="volume-mute" size={14} color={c.textTertiary} style={styles.muteIcon} />
          ) : null}
          <View style={styles.spacer} />
          {tick ? (
            <Ionicons
              name={tick}
              size={16}
              color={msg?.status === 'failed' ? c.error : c.success}
              style={styles.tick}
            />
          ) : null}
          <Text style={[styles.time, { color: unread && !chat.isMuted ? c.primary : c.textSecondary }]}>
            {formatChatTime(chat.updatedAt)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.preview, { color: c.textSecondary }]} numberOfLines={1}>
            {prefix ? <Text style={{ color: c.text }}>{prefix}: </Text> : null}
            <Text style={chat.isTyping ? { color: c.primary } : undefined}>{preview}</Text>
          </Text>

          {chat.unreadCount > 0 ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: chat.isMuted ? c.textTertiary : c.unreadBadge },
              ]}
            >
              <Text style={styles.badgeText} allowFontScaling={false}>
                {chat.unreadCount > 999 ? `${Math.floor(chat.unreadCount / 1000)}K` : chat.unreadCount}
              </Text>
            </View>
          ) : chat.isMarkedUnread ? (
            <View style={[styles.badge, styles.dot, { backgroundColor: c.unreadBadge }]} />
          ) : chat.isPinned ? (
            <Ionicons name="pin" size={17} color={c.textTertiary} style={styles.pin} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, height: 76 },
  avatar: { marginRight: 12 },
  content: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  typeIcon: { marginRight: 4 },
  name: { fontSize: 16.5, fontWeight: '600', flexShrink: 1 },
  muteIcon: { marginLeft: 4 },
  spacer: { flex: 1, minWidth: 8 },
  tick: { marginRight: 3 },
  time: { fontSize: 13 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  preview: { flex: 1, fontSize: 15 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  dot: { minWidth: 12, width: 12, height: 12, borderRadius: 6, paddingHorizontal: 0 },
  badgeText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' },
  pin: { marginLeft: 8, transform: [{ rotate: '45deg' }] },
});

export default ChatListItem;
