import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  Layout,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from '@/utils/haptics';
import { isToday, isYesterday, format, isSameDay } from 'date-fns';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useChatStore } from '@/stores/chat.store';
import type { ChatMessage } from '@/stores/chat.store';
import {
  closeChat,
  deleteMessage as tdDeleteMessage,
  loadHistory,
  markRead,
  openChat,
  sendText,
  setPinned,
  toggleReaction,
} from '@/services/tdlib/chats';
import type { ChatStackParamList } from '@/navigation/types';

import Avatar from '@/components/common/Avatar';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageInput from '@/components/chat/MessageInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'ChatDetail'>;

type ListItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'separator'; label: string; id: string };

interface ContextMenuOption {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

function getDateSeparatorLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE, d MMM');
}

// ---------------------------------------------------------------------------
// Date separator sub-component
// ---------------------------------------------------------------------------
interface DateSeparatorProps {
  label: string;
}

const DateSeparator = React.memo(function DateSeparator({ label }: DateSeparatorProps) {
  const theme = useTheme();
  return (
    <View style={separatorStyles.row} accessibilityRole="none" accessibilityElementsHidden>
      <View style={[separatorStyles.pill, { backgroundColor: theme.colors.surfaceElevated }]}>
        <Text
          style={[
            theme.textStyles.caption,
            { color: theme.colors.textSecondary, fontWeight: theme.fontWeights.medium },
          ]}
        >
          {label}
        </Text>
      </View>
    </View>
  );
});

const separatorStyles = StyleSheet.create({
  row: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
});

// ---------------------------------------------------------------------------
// Pinned message bar sub-component
// ---------------------------------------------------------------------------
interface PinnedBarProps {
  message: ChatMessage;
  onDismiss: () => void;
}

const PinnedBar = React.memo(function PinnedBar({ message, onDismiss }: PinnedBarProps) {
  const theme = useTheme();

  const preview =
    message.type === 'voice'
      ? '🎤 Voice message'
      : message.type === 'image'
      ? '📷 Photo'
      : (message.text ?? '');

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        pinnedStyles.container,
        {
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.border,
          paddingHorizontal: theme.spacing.lg,
        },
      ]}
    >
      <Ionicons
        name="pin"
        size={14}
        color={theme.colors.primary}
        style={{ marginRight: theme.spacing.sm }}
      />
      <View style={pinnedStyles.text}>
        <Text
          style={[
            theme.textStyles.caption,
            { color: theme.colors.primary, fontWeight: theme.fontWeights.semibold },
          ]}
        >
          Pinned Message
        </Text>
        <Text
          style={[theme.textStyles.caption, { color: theme.colors.textSecondary }]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss pinned message"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={16} color={theme.colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
});

const pinnedStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    flex: 1,
    marginRight: 8,
  },
});

// ---------------------------------------------------------------------------
// Typing indicator sub-component
// ---------------------------------------------------------------------------
interface TypingIndicatorBarProps {
  name: string;
}

const TypingIndicatorBar = React.memo(function TypingIndicatorBar({
  name,
}: TypingIndicatorBarProps) {
  const theme = useTheme();

  // Animate 3 dots with staggered offsets
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = (sv: SharedValue<number>, delay: number) => {
      const loop = () => {
        sv.value = withTiming(-4, { duration: 300 }, () => {
          sv.value = withTiming(0, { duration: 300 }, () => {
            // Each cycle is 900ms; stagger restarts via setTimeout simulation
          });
        });
      };
      setTimeout(loop, delay);
      const id = setInterval(loop, 900);
      return id;
    };

    const id1 = animate(dot1, 0);
    const id2 = animate(dot2, 150);
    const id3 = animate(dot3, 300);

    return () => {
      clearInterval(id1);
      clearInterval(id2);
      clearInterval(id3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d1Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
  const d2Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
  const d3Style = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      layout={Layout.springify()}
      style={[
        typingStyles.container,
        { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
      ]}
    >
      <View style={[typingStyles.bubble, { backgroundColor: theme.colors.messageBubbleIncoming }]}>
        <Animated.View style={[typingStyles.dot, { backgroundColor: theme.colors.textSecondary }, d1Style]} />
        <Animated.View style={[typingStyles.dot, { backgroundColor: theme.colors.textSecondary }, d2Style]} />
        <Animated.View style={[typingStyles.dot, { backgroundColor: theme.colors.textSecondary }, d3Style]} />
      </View>
      <Text style={[theme.textStyles.caption, { color: theme.colors.textTertiary, marginLeft: 8 }]}>
        {name} is typing…
      </Text>
    </Animated.View>
  );
});

const typingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

// ---------------------------------------------------------------------------
// Context menu sub-component
// ---------------------------------------------------------------------------
interface ContextMenuProps {
  visible: boolean;
  message: ChatMessage | null;
  isOwnMessage: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onPin: () => void;
  onDelete: () => void;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const ContextMenu = React.memo(function ContextMenu({
  visible,
  message,
  isOwnMessage,
  onClose,
  onReact,
  onReply,
  onCopy,
  onPin,
  onDelete,
}: ContextMenuProps) {
  const theme = useTheme();

  const menuOpacity = useSharedValue(0);
  const menuScale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      menuOpacity.value = withTiming(1, { duration: 150 });
      menuScale.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      menuOpacity.value = withTiming(0, { duration: 100 });
      menuScale.value = withTiming(0.9, { duration: 100 });
    }
  }, [visible, menuOpacity, menuScale]);

  const animatedMenu = useAnimatedStyle(() => ({
    opacity: menuOpacity.value,
    transform: [{ scale: menuScale.value }],
  }));

  const options: ContextMenuOption[] = [
    { key: 'reply', label: 'Reply', icon: 'arrow-undo-outline' },
    { key: 'copy', label: 'Copy', icon: 'copy-outline' },
    { key: 'pin', label: message?.isPinned ? 'Unpin' : 'Pin', icon: 'pin-outline' },
    ...(isOwnMessage
      ? [{ key: 'delete', label: 'Delete', icon: 'trash-outline' as const, destructive: true }]
      : []),
  ];

  const handleOption = useCallback(
    (key: string) => {
      switch (key) {
        case 'reply':
          onReply();
          break;
        case 'copy':
          onCopy();
          break;
        case 'pin':
          onPin();
          break;
        case 'delete':
          onDelete();
          break;
      }
      onClose();
    },
    [onReply, onCopy, onPin, onDelete, onClose]
  );

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={contextStyles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            contextStyles.menu,
            animatedMenu,
            {
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.lg,
              ...theme.shadows.lg,
            },
          ]}
        >
          {/* Quick reactions row */}
          <View
            style={[
              contextStyles.reactionsRow,
              {
                borderBottomColor: theme.colors.border,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
              },
            ]}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  onReact(emoji);
                  onClose();
                }}
                style={contextStyles.reactionButton}
                accessibilityLabel={`React with ${emoji}`}
                accessibilityRole="button"
              >
                <Text style={contextStyles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action options */}
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.key}
              onPress={() => handleOption(option.key)}
              style={[
                contextStyles.optionRow,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  borderTopColor: theme.colors.border,
                  borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={option.label}
            >
              <Ionicons
                name={option.icon}
                size={20}
                color={option.destructive ? theme.colors.error : theme.colors.text}
                style={{ marginRight: theme.spacing.md }}
              />
              <Text
                style={[
                  theme.textStyles.bodyMedium,
                  { color: option.destructive ? theme.colors.error : theme.colors.text },
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

const contextStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  menu: {
    width: '100%',
    overflow: 'hidden',
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reactionButton: {
    padding: 6,
  },
  reactionEmoji: {
    fontSize: 26,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function ChatDetailScreen({ navigation, route }: Props) {
  const { chatId, chatType, title, avatarUrl } = route.params;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const {
    messages: allMessages,
    setMessages,
    addMessage,
    updateMessage,
    deleteMessage,
    setActiveChatId,
    markChatAsRead,
    replyingTo,
    setReplyingTo,
    pinnedMessages,
    setPinnedMessages,
    chats,
    typingIndicators,
    setTypingIndicator,
  } = useChatStore();

  const chatMessages = allMessages[chatId] ?? [];

  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [contextMenuMessage, setContextMenuMessage] = useState<ChatMessage | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showPinnedBar, setShowPinnedBar] = useState(true);

  const listRef = useRef<FlashListRef<ListItem>>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const chat = useMemo(() => chats.find((c) => c.id === chatId), [chats, chatId]);

  const firstPinnedMessage = useMemo(() => {
    // Check both pinnedMessages store and messages with isPinned flag
    const storePinned = pinnedMessages[chatId];
    if (storePinned && storePinned.length > 0) return storePinned[0] ?? null;
    return chatMessages.find((m) => m.isPinned) ?? null;
  }, [pinnedMessages, chatId, chatMessages]);

  const isOwnMessage = useCallback((msg: ChatMessage) => msg.senderId === 'me', []);

  // ---------------------------------------------------------------------------
  // Build flat list data: interleave date separators with messages
  // ---------------------------------------------------------------------------
  const listData = useMemo<ListItem[]>(() => {
    if (chatMessages.length === 0) return [];

    // Messages are stored oldest-first; the list is inverted so newest appears at bottom.
    // We reverse to iterate newest → oldest, insert separators, then reverse back.
    const sorted = [...chatMessages].sort(
      (a, b) => a.sentAt.getTime() - b.sentAt.getTime()
    );

    const items: ListItem[] = [];
    let lastDate: Date | null = null;

    for (const message of sorted) {
      if (lastDate === null || !isSameDay(message.sentAt, lastDate)) {
        items.push({
          kind: 'separator',
          label: getDateSeparatorLabel(message.sentAt),
          id: `sep_${message.sentAt.toDateString()}`,
        });
        lastDate = message.sentAt;
      }
      items.push({ kind: 'message', message });
    }

    // Reverse so the FlashList (inverted) shows newest at the bottom
    return items.reverse();
  }, [chatMessages]);

  // ---------------------------------------------------------------------------
  // Load messages on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setActiveChatId(chatId);
    setIsLoadingMessages(true);
    void openChat(chatId);
    loadHistory(chatId)
      .then(() => markRead(chatId))
      .catch(() => undefined)
      .finally(() => setIsLoadingMessages(false));
    markChatAsRead(chatId);

    return () => {
      setActiveChatId(null);
      void closeChat(chatId);
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // ---------------------------------------------------------------------------
  // Send message + simulate reply
  // ---------------------------------------------------------------------------
  const handleSendText = useCallback(
    async (text: string) => {
      const replyToId = replyingTo?.id;
      setReplyingTo(null);
      try {
        await sendText(chatId, text, replyToId);
      } catch (e) {
        Alert.alert('Xabar yuborilmadi', e instanceof Error ? e.message : String(e));
      }
    },
    [chatId, replyingTo, setReplyingTo]
  );

  const handleSendVoice = useCallback(async () => {
    // Ovozli xabar yozish 2-fazada (media) qo'shiladi.
    Alert.alert('Tez orada', "Ovozli xabar yuborish keyingi bosqichda qo'shiladi.");
  }, []);

  const handleAttachmentPress = useCallback(() => {
    // Future: open media picker
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ---------------------------------------------------------------------------
  // Message long-press → context menu
  // ---------------------------------------------------------------------------
  const handleMessageLongPress = useCallback((msg: ChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setContextMenuMessage(msg);
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenuMessage(null);
  }, []);

  const handleReact = useCallback(
    (emoji: string) => {
      if (!contextMenuMessage) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const chosen = contextMenuMessage.reactions.some((r) => r.emoji === emoji && r.hasCurrentUser);
      void toggleReaction(chatId, contextMenuMessage.id, emoji, !chosen);
    },
    [chatId, contextMenuMessage]
  );

  const handleReplyFromMenu = useCallback(() => {
    if (!contextMenuMessage) return;
    setReplyingTo(contextMenuMessage);
  }, [contextMenuMessage, setReplyingTo]);

  const handleCopy = useCallback(() => {
    if (!contextMenuMessage) return;
    const text = contextMenuMessage.text ?? '';
    Clipboard.setString(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [contextMenuMessage]);

  const handlePin = useCallback(() => {
    if (!contextMenuMessage) return;
    setPinned(chatId, contextMenuMessage.id, !contextMenuMessage.isPinned).catch((e: unknown) =>
      Alert.alert('Bajarilmadi', e instanceof Error ? e.message : String(e))
    );
    setShowPinnedBar(true);
  }, [chatId, contextMenuMessage]);

  const handleDelete = useCallback(() => {
    if (!contextMenuMessage) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    // O'z xabarlari hamma uchun o'chiriladi, boshqalarniki — faqat o'zida.
    tdDeleteMessage(chatId, contextMenuMessage.id, contextMenuMessage.senderId === 'me').catch(
      (e: unknown) => Alert.alert("O'chirilmadi", e instanceof Error ? e.message : String(e))
    );
  }, [chatId, contextMenuMessage]);

  const handleReplyPress = useCallback((_replyId: string) => {
    // Future: scroll to the replied message
  }, []);

  const handleReactionPress = useCallback(
    (messageId: string, emoji: string) => {
      const msg = chatMessages.find((m) => m.id === messageId);
      const existing = msg?.reactions.find((r) => r.emoji === emoji);
      if (!existing) return;
      void toggleReaction(chatId, messageId, emoji, !existing.hasCurrentUser);
    },
    [chatId, chatMessages]
  );

  // ---------------------------------------------------------------------------
  // Header navigation
  // ---------------------------------------------------------------------------
  const handleHeaderPress = useCallback(() => {
    if (chatType === 'group' || chatType === 'topic_group') {
      navigation.navigate('GroupInfo', { chatId });
    } else if (chatType === 'channel') {
      navigation.navigate('ChannelInfo', { chatId });
    } else {
      // private — find the other user
      const otherUserId = chat?.otherUser?.id;
      if (otherUserId) {
        navigation.navigate('Profile', { userId: otherUserId });
      }
    }
  }, [chatType, chatId, chat, navigation]);

  const handleVideoCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Future: initiate video call
  }, []);

  const handleMoreOptions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Future: open options sheet
  }, []);

  // ---------------------------------------------------------------------------
  // Header sub-title
  // ---------------------------------------------------------------------------
  const headerSubtitle = useMemo(() => {
    if (chatType === 'group' || chatType === 'topic_group' || chatType === 'channel') {
      const count = chat?.memberCount;
      return count != null ? `${count} members` : 'Group';
    }
    const otherUser = chat?.otherUser;
    if (!otherUser) return '';
    if (otherUser.status === 'online') return 'Online';
    if (otherUser.status === 'recently') return 'Recently online';
    return 'Offline';
  }, [chatType, chat]);

  // ---------------------------------------------------------------------------
  // Render item
  // ---------------------------------------------------------------------------
  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'separator') {
        return <DateSeparator label={item.label} />;
      }
      const { message } = item;
      return (
        <MessageBubble
          message={message}
          isOwn={isOwnMessage(message)}
          showSender={
            (chatType === 'group' || chatType === 'topic_group') && !isOwnMessage(message)
          }
          onLongPress={handleMessageLongPress}
          onReplyPress={handleReplyPress}
          onReactionPress={handleReactionPress}
        />
      );
    },
    [chatType, isOwnMessage, handleMessageLongPress, handleReplyPress, handleReactionPress]
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.kind === 'separator') return item.id;
    return item.message.id;
  }, []);

  const getItemType = useCallback((item: ListItem) => item.kind, []);

  // ---------------------------------------------------------------------------
  // Loading / empty states
  // ---------------------------------------------------------------------------
  if (isLoadingMessages && chatMessages.length === 0) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
          </TouchableOpacity>
          <Text
            style={[theme.textStyles.headingSmall, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <LoadingState message="Loading messages..." />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.border,
            paddingHorizontal: theme.spacing.sm,
          },
        ]}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
        </TouchableOpacity>

        {/* Center: avatar + name/status — tappable */}
        <TouchableOpacity
          onPress={handleHeaderPress}
          style={styles.headerCenter}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`View ${chatType === 'group' ? 'group' : 'profile'} info`}
        >
          <Avatar
            uri={avatarUrl}
            name={title}
            size={36}
            showOnline={chatType === 'private'}
            isOnline={chat?.isOnline}
            style={{ marginRight: theme.spacing.sm }}
          />
          <View style={styles.headerTitleGroup}>
            <Text
              style={[theme.textStyles.chatName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {title}
            </Text>
            <Text
              style={[
                theme.textStyles.caption,
                {
                  color:
                    chat?.otherUser?.status === 'online'
                      ? theme.colors.onlineDot
                      : theme.colors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {headerSubtitle}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right actions */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleVideoCall}
            style={[styles.headerIconButton, { marginRight: theme.spacing.xs }]}
            accessibilityRole="button"
            accessibilityLabel="Video call"
          >
            <Ionicons name="videocam-outline" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleMoreOptions}
            style={styles.headerIconButton}
            accessibilityRole="button"
            accessibilityLabel="More options"
          >
            <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Pinned message bar                                                   */}
      {/* ------------------------------------------------------------------ */}
      {firstPinnedMessage != null && showPinnedBar && (
        <PinnedBar
          message={firstPinnedMessage}
          onDismiss={() => setShowPinnedBar(false)}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Messages list                                                        */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.listContainer}>
        <FlashList
          ref={listRef}
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemType={getItemType}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
          }}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <EmptyState
                icon="💬"
                title={isLoadingMessages ? 'Yuklanmoqda…' : "Hali xabar yo'q"}
                subtitle={isLoadingMessages ? '' : 'Birinchi xabarni yozing'}
              />
            </View>
          }
          // Keyboard handling
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />

        {/* Typing indicator sits above the input and is part of the scroll area */}
        {isTyping && (
          <TypingIndicatorBar
            name={chat?.otherUser?.firstName ?? chat?.name ?? 'Someone'}
          />
        )}
      </View>

      {/* ------------------------------------------------------------------ */}
      {/* Message input                                                        */}
      {/* ------------------------------------------------------------------ */}
      <MessageInput
        chatId={chatId}
        replyingTo={replyingTo}
        onSendText={handleSendText}
        onSendVoice={handleSendVoice}
        onAttachmentPress={handleAttachmentPress}
        onCancelReply={() => setReplyingTo(null)}
      />

      {/* ------------------------------------------------------------------ */}
      {/* Context menu                                                         */}
      {/* ------------------------------------------------------------------ */}
      <ContextMenu
        visible={contextMenuMessage !== null}
        message={contextMenuMessage}
        isOwnMessage={contextMenuMessage !== null && isOwnMessage(contextMenuMessage)}
        onClose={handleContextMenuClose}
        onReact={handleReact}
        onReply={handleReplyFromMenu}
        onCopy={handleCopy}
        onPin={handlePin}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    padding: 6,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  headerTitleGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 4,
  },
  headerIconButton: {
    padding: 6,
  },
  listContainer: {
    flex: 1,
  },
  emptyMessages: {
    // FlashList 2 empty state'ni inverted qilmaydi — qo'shimcha aylantirish kerak emas.
    flex: 1,
    minHeight: 400,
  },
});
