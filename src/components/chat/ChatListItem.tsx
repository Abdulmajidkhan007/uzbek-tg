import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import Badge from '@/components/ui/Badge';
import { Chat } from '@/stores/chat.store';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface ChatListItemProps {
  chat: Chat;
  onPress: (chatId: string) => void;
  onLongPress?: (chatId: string) => void;
  currentUserId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTimestamp(date: Date): string {
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEE');
  if (isThisYear(date)) return format(date, 'MMM d');
  return format(date, 'MM/dd/yy');
}

interface PreviewResult {
  text: string;
  prefix: string;
  isTyping: boolean;
  isDeleted: boolean;
  isVoice: boolean;
  isImage: boolean;
}

function buildPreview(chat: Chat, currentUserId: string | undefined): PreviewResult {
  const base: PreviewResult = {
    text: '',
    prefix: '',
    isTyping: false,
    isDeleted: false,
    isVoice: false,
    isImage: false,
  };

  if (chat.isTyping) {
    const who = chat.typingUserName ?? 'Someone';
    return { ...base, text: `${who} yozmoqda...`, isTyping: true };
  }

  const msg = chat.lastMessage;
  if (!msg) {
    return { ...base, text: "Hali xabar yo'q" };
  }

  if (msg.isDeleted) {
    return { ...base, text: "Xabar o'chirilgan", isDeleted: true };
  }

  const isOwn = currentUserId != null && msg.senderId === currentUserId;
  return {
    ...base,
    prefix: isOwn ? 'Siz: ' : '',
    text: msg.previewText ?? msg.text ?? '',
  };
}

// ---------------------------------------------------------------------------
// Swipe action renderers
// ---------------------------------------------------------------------------
function RightActions({
  onDelete,
  theme,
}: {
  onDelete: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: theme.colors.error }]}
        onPress={onDelete}
        accessibilityLabel="Delete chat"
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        <Text style={styles.swipeLabel}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

function LeftActions({
  onPin,
  onMute,
  isPinned,
  isMuted,
  theme,
}: {
  onPin: () => void;
  onMute: () => void;
  isPinned: boolean;
  isMuted: boolean;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: theme.colors.accent }]}
        onPress={onPin}
        accessibilityLabel={isPinned ? 'Unpin chat' : 'Pin chat'}
        accessibilityRole="button"
      >
        <Ionicons
          name={isPinned ? 'pin' : 'pin-outline'}
          size={22}
          color="#FFFFFF"
        />
        <Text style={styles.swipeLabel}>{isPinned ? 'Unpin' : 'Pin'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: theme.colors.textSecondary }]}
        onPress={onMute}
        accessibilityLabel={isMuted ? 'Unmute chat' : 'Mute chat'}
        accessibilityRole="button"
      >
        <Ionicons
          name={isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
          size={22}
          color="#FFFFFF"
        />
        <Text style={styles.swipeLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ChatListItem = React.memo(function ChatListItem({
  chat,
  onPress,
  onLongPress,
  currentUserId,
}: ChatListItemProps) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const handlePress = useCallback(() => {
    onPress(chat.id);
  }, [onPress, chat.id]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(chat.id);
  }, [onLongPress, chat.id]);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const handlePin = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const handleMute = useCallback(() => {
    swipeableRef.current?.close();
  }, []);

  const preview = buildPreview(chat, currentUserId);
  const timestamp = formatTimestamp(chat.updatedAt);
  const isPrivate = chat.type === 'private';
  const avatarUri = chat.avatarUrl ?? chat.otherUser?.avatarUrl;

  // Determine preview text color
  let previewColor = theme.colors.textSecondary;
  if (preview.isTyping) previewColor = theme.colors.primary;
  if (preview.isDeleted) previewColor = theme.colors.textTertiary;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={() => (
        <RightActions onDelete={handleDelete} theme={theme} />
      )}
      renderLeftActions={() => (
        <LeftActions
          onPin={handlePin}
          onMute={handleMute}
          isPinned={chat.isPinned}
          isMuted={chat.isMuted}
          theme={theme}
        />
      )}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[
          styles.row,
          {
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
          },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${chat.name} chat`}
        accessibilityHint="Opens the chat conversation"
      >
        {/* Avatar */}
        <Avatar
          uri={avatarUri}
          name={chat.name}
          size={52}
          showOnline={isPrivate}
          isOnline={chat.isOnline}
          style={{ marginRight: theme.spacing.md }}
        />

        {/* Content column */}
        <View style={styles.content}>
          {/* Top row: chat name + timestamp */}
          <View style={styles.topRow}>
            <Text
              style={[
                theme.textStyles.chatName,
                { color: theme.colors.text, flex: 1 },
              ]}
              numberOfLines={1}
            >
              {chat.name}
            </Text>

            <View style={styles.timestampGroup}>
              {chat.isPinned && chat.unreadCount === 0 && (
                <Ionicons
                  name="pin"
                  size={12}
                  color={theme.colors.textTertiary}
                  style={styles.pinIcon}
                />
              )}
              <Text
                style={[
                  theme.textStyles.chatTimestamp,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {timestamp}
              </Text>
            </View>
          </View>

          {/* Bottom row: preview text + unread badge */}
          <View style={styles.bottomRow}>
            <Text
              style={[
                theme.textStyles.chatPreview,
                {
                  color: previewColor,
                  fontStyle: preview.isTyping ? 'italic' : 'normal',
                  flex: 1,
                },
              ]}
              numberOfLines={1}
            >
              {preview.isVoice && '🎤 '}
              {preview.isImage && '📷 '}
              {preview.prefix}
              {preview.text}
            </Text>

            {chat.unreadCount > 0 && (
              <Badge
                count={chat.unreadCount}
                muted={chat.isMuted}
                style={{ marginLeft: theme.spacing.sm }}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  pinIcon: {
    marginRight: 3,
  },
  swipeContainer: {
    flexDirection: 'row',
  },
  swipeAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default ChatListItem;
