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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import { mockGroupMessages, mockChats } from '@/data/mock';
import type { ChatStackParamList } from '@/navigation/types';
import type { ChatMessage } from '@/stores/chat.store';
import MessageInput from '@/components/chat/MessageInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'TopicDetail'>;

// ---------------------------------------------------------------------------
// Topic header banner
// ---------------------------------------------------------------------------
interface TopicBannerProps {
  topicTitle: string;
  chatName: string;
  description: string;
}

const TopicBanner = React.memo(function TopicBanner({
  topicTitle,
  chatName,
  description,
}: TopicBannerProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.topicBanner,
        {
          backgroundColor: theme.colors.primary + '14',
          borderColor: theme.colors.primary + '30',
          margin: theme.spacing.md,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        },
      ]}
    >
      <View style={styles.bannerRow}>
        <View
          style={[
            styles.topicIcon,
            {
              backgroundColor: theme.colors.primary + '22',
              borderRadius: theme.radius.sm,
              width: 36,
              height: 36,
            },
          ]}
        >
          <Ionicons name="chatbubbles-outline" size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.bannerText}>
          <Text
            style={[
              theme.textStyles.chatName,
              { color: theme.colors.primary },
            ]}
          >
            {topicTitle}
          </Text>
          <Text
            style={[
              theme.textStyles.caption,
              { color: theme.colors.textSecondary },
            ]}
          >
            in {chatName}
          </Text>
        </View>
      </View>
      {description.length > 0 && (
        <Text
          style={[
            theme.textStyles.bodySmall,
            {
              color: theme.colors.textSecondary,
              marginTop: theme.spacing.sm,
              lineHeight: theme.fontSizes.sm * theme.lineHeights.relaxed,
            },
          ]}
        >
          {description}
        </Text>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Message bubble sub-component
// ---------------------------------------------------------------------------
interface TopicMessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
}

const TopicMessageBubble = React.memo(function TopicMessageBubble({
  message,
  isOwn,
}: TopicMessageBubbleProps) {
  const theme = useTheme();
  const senderName = `${message.senderPreview.firstName}${message.senderPreview.lastName ? ` ${message.senderPreview.lastName}` : ''}`;

  const timeLabel = useMemo(() => {
    const h = message.sentAt.getHours().toString().padStart(2, '0');
    const m = message.sentAt.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }, [message.sentAt]);

  return (
    <View
      style={[
        styles.bubbleRow,
        isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther,
        { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
      ]}
    >
      {!isOwn && (
        <Avatar
          uri={message.senderPreview.avatarUrl}
          name={senderName}
          size={32}
          style={{ alignSelf: 'flex-end', marginRight: theme.spacing.sm }}
        />
      )}
      <View style={[styles.bubbleContent, { maxWidth: '75%' }]}>
        {!isOwn && (
          <Text
            style={[
              theme.textStyles.caption,
              {
                color: theme.colors.primary,
                fontWeight: theme.fontWeights.semibold,
                marginBottom: 2,
                marginLeft: theme.spacing.sm,
              },
            ]}
          >
            {senderName}
          </Text>
        )}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isOwn
                ? theme.colors.messageBubbleOutgoing
                : theme.colors.messageBubbleIncoming,
              borderRadius: theme.radius.lg,
              borderBottomRightRadius: isOwn ? theme.radius.xs : theme.radius.lg,
              borderBottomLeftRadius: isOwn ? theme.radius.lg : theme.radius.xs,
              padding: theme.spacing.md,
            },
          ]}
        >
          {message.isDeleted ? (
            <Text
              style={[
                theme.textStyles.bodySmall,
                { color: theme.colors.textTertiary, fontStyle: 'italic' },
              ]}
            >
              This message was deleted
            </Text>
          ) : message.type === 'voice' ? (
            <Text
              style={[
                theme.textStyles.bodySmall,
                {
                  color: isOwn
                    ? theme.colors.messageBubbleOutgoingText
                    : theme.colors.messageBubbleIncomingText,
                  fontStyle: 'italic',
                },
              ]}
            >
              Voice message · {message.duration?.toFixed(0) ?? 0}s
            </Text>
          ) : message.type === 'image' ? (
            <Text
              style={[
                theme.textStyles.bodySmall,
                {
                  color: isOwn
                    ? theme.colors.messageBubbleOutgoingText
                    : theme.colors.messageBubbleIncomingText,
                  fontStyle: 'italic',
                },
              ]}
            >
              Photo
            </Text>
          ) : (
            <Text
              style={[
                theme.textStyles.chatMessage,
                {
                  color: isOwn
                    ? theme.colors.messageBubbleOutgoingText
                    : theme.colors.messageBubbleIncomingText,
                },
              ]}
            >
              {message.text}
            </Text>
          )}
        </View>
        <Text
          style={[
            theme.textStyles.caption,
            {
              color: theme.colors.textTertiary,
              marginTop: 2,
              alignSelf: isOwn ? 'flex-end' : 'flex-start',
              marginHorizontal: theme.spacing.sm,
            },
          ]}
        >
          {timeLabel}
        </Text>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function TopicDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { chatId, topicId, topicTitle } = route.params;

  const listRef = useRef<FlashListRef<ChatMessage>>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const chat = useMemo(
    () => mockChats.find((c) => c.id === chatId) ?? null,
    [chatId],
  );

  // Simulate loading topic messages
  useEffect(() => {
    const timer = setTimeout(() => {
      // Filter messages to simulate topic scope — use a subset
      const topicMessages = mockGroupMessages.filter(
        (_m, i) => i % 2 === (topicId.length % 2),
      );
      setMessages(topicMessages.length > 0 ? topicMessages : mockGroupMessages.slice(0, 5));
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [topicId]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSendText = useCallback(
    (text: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newMsg: ChatMessage = {
        id: `topic_msg_${Date.now()}`,
        chatId,
        senderId: 'me',
        senderPreview: {
          id: 'me',
          firstName: 'You',
          avatarUrl: 'https://i.pravatar.cc/150?img=33',
          status: 'online',
          isVerified: false,
        },
        type: 'text',
        text,
        status: 'sent',
        sentAt: new Date(),
        isDeleted: false,
        isPinned: false,
        replyTo: null,
        reactions: [],
      };
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);
    },
    [chatId],
  );

  const handleSendVoice = useCallback(
    (_uri: string, _duration: number, _waveform: number[]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newMsg: ChatMessage = {
        id: `topic_msg_${Date.now()}`,
        chatId,
        senderId: 'me',
        senderPreview: {
          id: 'me',
          firstName: 'You',
          avatarUrl: 'https://i.pravatar.cc/150?img=33',
          status: 'online',
          isVerified: false,
        },
        type: 'voice',
        duration: _duration,
        waveform: _waveform,
        status: 'sent',
        sentAt: new Date(),
        isDeleted: false,
        isPinned: false,
        replyTo: null,
        reactions: [],
      };
      setMessages((prev) => [...prev, newMsg]);
    },
    [chatId],
  );

  const handleAttachmentPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <TopicMessageBubble message={item} isOwn={item.senderId === 'me'} />
    ),
    [],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const topicDescription =
    'Discuss and collaborate on this topic thread. All messages here are scoped to this topic.';

  const headerComponent = useMemo(
    () => (
      <TopicBanner
        topicTitle={topicTitle}
        chatName={chat?.name ?? 'Group'}
        description={topicDescription}
      />
    ),
    [topicTitle, chat],
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderBottomColor: theme.colors.borderSubtle,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View
            style={[
              styles.topicIconSmall,
              { backgroundColor: theme.colors.primary + '22', borderRadius: theme.radius.xs },
            ]}
          >
            <Ionicons name="chatbubbles-outline" size={14} color={theme.colors.primary} />
          </View>
          <View>
            <Text
              style={[theme.textStyles.chatName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {topicTitle}
            </Text>
            <Text
              style={[theme.textStyles.caption, { color: theme.colors.textSecondary }]}
              numberOfLines={1}
            >
              {chat?.name ?? 'Forum Group'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          activeOpacity={0.7}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <LoadingState message="Loading topic..." />
        ) : messages.length === 0 ? (
          <View style={styles.flex}>
            {headerComponent}
            <EmptyState
              icon="💬"
              title="No messages yet"
              subtitle="Be the first to reply to this topic."
            />
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={headerComponent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: theme.spacing.md }}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Message input */}
        <MessageInput
          chatId={chatId}
          replyingTo={null}
          onSendText={handleSendText}
          onSendVoice={handleSendVoice}
          onAttachmentPress={handleAttachmentPress}
          onCancelReply={() => {}}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicIconSmall: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicBanner: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topicIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1 },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  bubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubbleContent: {},
  bubble: {},
});
