import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import Divider from '@/components/ui/Divider';
import { useChatStore } from '@/stores/chat.store';
import { setChatJoined, setChatMuted } from '@/services/tdlib/chats';
import type { ChatStackParamList } from '@/navigation/types';
import type { ChatMessage } from '@/stores/chat.store';
import { showAlert } from '@/components/ui/Dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'ChannelInfo'>;

// ---------------------------------------------------------------------------
// Post preview sub-component
// ---------------------------------------------------------------------------
interface PostPreviewProps {
  message: ChatMessage;
  onPress: () => void;
}

const PostPreview = React.memo(function PostPreview({ message, onPress }: PostPreviewProps) {
  const theme = useTheme();

  const timeLabel = useMemo(() => {
    const diff = Date.now() - message.sentAt.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }, [message.sentAt]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={[
        styles.postCard,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          marginHorizontal: theme.spacing.lg,
          borderColor: theme.colors.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {message.type === 'image' && message.mediaUrl ? (
        <Image
          source={{ uri: message.mediaUrl }}
          style={[styles.postImage, { borderRadius: theme.radius.sm }]}
          resizeMode="cover"
        />
      ) : null}
      {message.text ? (
        <Text
          style={[
            theme.textStyles.bodyMedium,
            { color: theme.colors.text, marginTop: message.mediaUrl ? theme.spacing.sm : 0 },
          ]}
          numberOfLines={3}
        >
          {message.text}
        </Text>
      ) : null}
      <View style={[styles.postMeta, { marginTop: theme.spacing.sm }]}>
        <Text style={[theme.textStyles.caption, { color: theme.colors.textTertiary }]}>
          {timeLabel}
        </Text>
        {message.reactions.length > 0 && (
          <Text style={[theme.textStyles.caption, { color: theme.colors.textSecondary }]}>
            {message.reactions.map((r) => `${r.emoji} ${r.count}`).join('  ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Stat badge sub-component
// ---------------------------------------------------------------------------
interface StatBadgeProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  value: string;
  label: string;
}

const StatBadge = React.memo(function StatBadge({ icon, value, label }: StatBadgeProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.statBadge,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <Text
        style={[
          theme.textStyles.headingSmall,
          { color: theme.colors.text, marginTop: theme.spacing.xs },
        ]}
      >
        {value}
      </Text>
      <Text style={[theme.textStyles.caption, { color: theme.colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function ChannelInfoScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { chatId } = route.params;

  const chats = useChatStore((s) => s.chats);
  const chatMessages = useChatStore((s) => s.messages[chatId]);
  const chat = useMemo(() => chats.find((c) => c.id === chatId) ?? null, [chats, chatId]);

  const [isJoined, setIsJoined] = useState(true);
  const [isMuted, setIsMuted] = useState(chat?.isMuted ?? false);

  const posts = useMemo(() => (chatMessages ?? []).slice(-4).reverse(), [chatMessages]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleJoinToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isJoined) {
      showAlert(
        'Leave Channel',
        `Leave "${chat?.name ?? 'this channel'}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => {
              setIsJoined(false);
              void setChatJoined(chatId, false);
              navigation.goBack();
            },
          },
        ],
      );
    } else {
      setIsJoined(true);
      void setChatJoined(chatId, true);
    }
  }, [isJoined, chat, navigation, chatId]);

  const handleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => {
      void setChatMuted(chatId, !prev);
      return !prev;
    });
  }, [chatId]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `${chat?.name ?? 'Kanal'}`,
        title: chat?.name ?? 'Channel',
      });
    } catch {
      // Share dismissed
    }
  }, [chat]);

  const handlePostPress = useCallback(
    (message: ChatMessage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('ChatDetail', {
        chatId: message.chatId,
        chatType: 'channel',
        title: chat?.name ?? 'Channel',
        avatarUrl: chat?.avatarUrl,
      });
    },
    [navigation, chat],
  );

  if (!chat) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={styles.centered}>
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.textSecondary }]}>
            Channel not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const memberCountStr =
    chat.memberCount != null
      ? chat.memberCount >= 1000
        ? `${(chat.memberCount / 1000).toFixed(1)}k`
        : `${chat.memberCount}`
      : '0';

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
        <Text
          style={[
            theme.textStyles.headingSmall,
            { color: theme.colors.text, flex: 1, textAlign: 'center' },
          ]}
          numberOfLines={1}
        >
          Channel Info
        </Text>
        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.7}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Share channel"
        >
          <Ionicons name="share-outline" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Hero */}
        <View
          style={[
            styles.hero,
            {
              paddingVertical: theme.spacing.xxl,
              borderBottomColor: theme.colors.borderSubtle,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View style={styles.channelAvatarWrapper}>
            <Avatar uri={chat.avatarUrl} name={chat.name} size={80} />
            <View
              style={[
                styles.channelBadge,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.full,
                  borderColor: theme.colors.surface,
                },
              ]}
            >
              <Ionicons name="megaphone" size={12} color="#FFFFFF" />
            </View>
          </View>
          <Text
            style={[
              theme.textStyles.headingMedium,
              { color: theme.colors.text, marginTop: theme.spacing.md, textAlign: 'center' },
            ]}
          >
            {chat.name}
          </Text>
          <Text
            style={[
              theme.textStyles.bodySmall,
              { color: theme.colors.textSecondary, marginTop: theme.spacing.xs },
            ]}
          >
            @{chat.name.toLowerCase().replace(/\s+/g, '_')}
          </Text>
          <Text
            style={[
              theme.textStyles.bodyMedium,
              {
                color: theme.colors.textSecondary,
                marginTop: theme.spacing.md,
                textAlign: 'center',
                paddingHorizontal: theme.spacing.xxl,
                lineHeight: theme.fontSizes.md * theme.lineHeights.relaxed,
              },
            ]}
          >
            Stay up to date with the latest news, trends, and insights from our editorial team.
          </Text>
        </View>

        {/* Stats row */}
        <View
          style={[
            styles.statsRow,
            { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, gap: theme.spacing.md },
          ]}
        >
          <StatBadge icon="people-outline" value={memberCountStr} label="Subscribers" />
          <StatBadge icon="eye-outline" value="12.4k" label="Avg. Views" />
          <StatBadge icon="bar-chart-outline" value="94%" label="Engaged" />
        </View>

        <Divider />

        {/* Join / Mute / Share buttons */}
        <View
          style={[
            styles.actionsRow,
            { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, gap: theme.spacing.md },
          ]}
        >
          <TouchableOpacity
            onPress={handleJoinToggle}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isJoined ? 'Leave channel' : 'Join channel'}
            style={[
              styles.joinBtn,
              {
                backgroundColor: isJoined ? theme.colors.surfaceElevated : theme.colors.primary,
                borderRadius: theme.radius.full,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.xxl,
              },
            ]}
          >
            <Ionicons
              name={isJoined ? 'checkmark-circle-outline' : 'add-circle-outline'}
              size={18}
              color={isJoined ? theme.colors.textSecondary : '#FFFFFF'}
            />
            <Text
              style={[
                theme.textStyles.buttonMedium,
                {
                  color: isJoined ? theme.colors.textSecondary : '#FFFFFF',
                  marginLeft: theme.spacing.xs,
                },
              ]}
            >
              {isJoined ? 'Joined' : 'Join'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleMute}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
            style={[
              styles.muteBtn,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.full,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.xl,
              },
            ]}
          >
            <Ionicons
              name={isMuted ? 'notifications-off-outline' : 'notifications-outline'}
              size={18}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share channel"
            style={[
              styles.muteBtn,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.full,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.xl,
              },
            ]}
          >
            <Ionicons name="share-social-outline" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Divider />

        {/* Recent posts */}
        <Text
          style={[
            theme.textStyles.bodySmall,
            {
              color: theme.colors.textSecondary,
              fontWeight: theme.fontWeights.semibold,
              textTransform: 'uppercase',
              letterSpacing: theme.letterSpacing.wide,
              paddingHorizontal: theme.spacing.lg,
              paddingTop: theme.spacing.xxl,
              paddingBottom: theme.spacing.md,
            },
          ]}
        >
          Recent Posts
        </Text>

        <View style={{ gap: theme.spacing.md }}>
          {posts.map((post) => (
            <PostPreview
              key={post.id}
              message={post}
              onPress={() => handlePostPress(post)}
            />
          ))}
        </View>

        <Divider style={{ marginTop: theme.spacing.xxl }} />

        {/* Share channel CTA */}
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xxl }}>
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Share channel"
            style={[
              styles.shareCta,
              {
                backgroundColor: theme.colors.primary + '18',
                borderRadius: theme.radius.md,
                paddingVertical: theme.spacing.md,
                borderColor: theme.colors.primary + '40',
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Ionicons name="share-social-outline" size={20} color={theme.colors.primary} />
            <Text
              style={[
                theme.textStyles.buttonMedium,
                { color: theme.colors.primary, marginLeft: theme.spacing.sm },
              ]}
            >
              Share Channel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  root: { flex: 1 },
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  channelAvatarWrapper: {
    position: 'relative',
  },
  channelBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statBadge: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 100,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  muteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {},
  postImage: {
    width: '100%',
    height: 160,
  },
  postMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
