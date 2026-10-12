import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import Divider from '@/components/ui/Divider';
import { useChatStore } from '@/stores/chat.store';
import { openPrivateChat, setUserBlocked } from '@/services/tdlib/chats';
import type { ChatStackParamList } from '@/navigation/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<ChatStackParamList, 'Profile'>;

// ---------------------------------------------------------------------------
// Action button
// ---------------------------------------------------------------------------
interface ActionButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  color?: string;
}

const ActionButton = React.memo(function ActionButton({
  icon,
  label,
  onPress,
  color,
}: ActionButtonProps) {
  const theme = useTheme();
  const c = color ?? theme.colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.actionBtn,
        {
          backgroundColor: theme.colors.surfaceElevated,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.sm,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={c} />
      <Text
        style={[
          theme.textStyles.caption,
          { color: c, marginTop: 4, fontWeight: theme.fontWeights.medium, textAlign: 'center' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ---------------------------------------------------------------------------
// Info row
// ---------------------------------------------------------------------------
const InfoRow = React.memo(function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.infoRow,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          backgroundColor: theme.colors.surfaceElevated,
        },
      ]}
    >
      <Ionicons name={icon} size={18} color={theme.colors.textSecondary} style={{ width: 24 }} />
      <View style={styles.infoText}>
        <Text style={[theme.textStyles.caption, { color: theme.colors.textSecondary }]}>
          {label}
        </Text>
        <Text
          style={[theme.textStyles.bodyMedium, { color: theme.colors.text, marginTop: 2 }]}
          selectable
        >
          {value}
        </Text>
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export function ProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const { userId } = route.params;

  const chats = useChatStore((s) => s.chats);
  const user = useMemo(
    () => chats.find((c) => c.otherUser?.id === userId)?.otherUser ?? null,
    [chats, userId],
  );
  const [isBlocked, setIsBlocked] = useState(false);

  const fullName = useMemo(
    () => (user ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : 'Unknown User'),
    [user],
  );

  const statusLabel = useMemo(() => {
    if (!user) return '';
    if (user.status === 'online') return 'Online';
    if (user.status === 'recently') return 'Last seen recently';
    return 'Offline';
  }, [user]);

  const handleBack = useCallback(() => navigation.goBack(), [navigation]);

  const handleMessage = useCallback(() => {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openPrivateChat(user.id)
      .then((chat) =>
        navigation.navigate('ChatDetail', {
          chatId: chat.id,
          chatType: chat.type,
          title: chat.name,
          avatarUrl: chat.avatarUrl,
        }),
      )
      .catch(() => undefined);
  }, [user, navigation]);

  const handleCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Voice Call', `Calling ${fullName}...`);
  }, [fullName]);

  const handleVideoCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Video Call', `Starting video call with ${fullName}...`);
  }, [fullName]);

  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `${fullName} is on Pulse Messenger${user?.username ? ` as ${user.username}` : ''}.`,
        title: fullName,
      });
    } catch {
      // Share dismissed
    }
  }, [fullName, user]);

  const handleBlock = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isBlocked) {
      Alert.alert('Unblock User', `Allow ${fullName} to message you again?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () => {
            setIsBlocked(false);
            void setUserBlocked(userId, false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    } else {
      Alert.alert('Block User', `Block ${fullName}? They won't be able to message you.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            setIsBlocked(true);
            void setUserBlocked(userId, true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    }
  }, [isBlocked, fullName]);

  const handleMore = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(fullName, 'More options', [
      { text: 'Report User', style: 'destructive', onPress: () => {} },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [fullName]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.textSecondary }]}>
            User not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomColor: theme.colors.borderSubtle },
        ]}
      >
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[theme.textStyles.headingSmall, { color: theme.colors.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          Profile
        </Text>
        <TouchableOpacity onPress={handleMore} activeOpacity={0.7} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="More options">
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Hero */}
        <View style={[styles.hero, { paddingVertical: theme.spacing.xxl, backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.borderSubtle }]}>
          <Avatar uri={user.avatarUrl} name={fullName} size={88} showOnline isOnline={user.status === 'online'} />
          <View style={styles.heroNameRow}>
            <Text style={[theme.textStyles.headingMedium, { color: theme.colors.text, marginTop: theme.spacing.md }]}>
              {fullName}
            </Text>
            {user.isVerified && (
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} style={{ marginLeft: 6, marginTop: theme.spacing.md }} />
            )}
          </View>
          {user.username ? (
            <Text style={[theme.textStyles.bodySmall, { color: theme.colors.primary, marginTop: theme.spacing.xs }]}>
              {user.username}
            </Text>
          ) : null}
          <Text style={[theme.textStyles.bodySmall, { color: user.status === 'online' ? theme.colors.secondary : theme.colors.textSecondary, marginTop: theme.spacing.xs }]}>
            {statusLabel}
          </Text>
          {/* Actions */}
          <View style={[styles.actionsRow, { marginTop: theme.spacing.xl, paddingHorizontal: theme.spacing.xl, gap: theme.spacing.md }]}>
            <ActionButton icon="chatbubble-outline" label="Message" onPress={handleMessage} />
            <ActionButton icon="call-outline" label="Call" onPress={handleCall} />
            <ActionButton icon="videocam-outline" label="Video" onPress={handleVideoCall} />
            <ActionButton icon="share-outline" label="Share" onPress={handleShare} />
          </View>
        </View>

        {/* Info */}
        <Text style={[theme.textStyles.bodySmall, { color: theme.colors.textSecondary, fontWeight: theme.fontWeights.semibold, textTransform: 'uppercase', letterSpacing: theme.letterSpacing.wide, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.sm }]}>
          Info
        </Text>
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <View style={{ borderRadius: theme.radius.md, overflow: 'hidden' }}>
            {user.username ? (
              <>
                <InfoRow icon="at-outline" label="Username" value={user.username} />
                <Divider inset={theme.spacing.lg + 24 + theme.spacing.md} />
              </>
            ) : null}
            <InfoRow icon="radio-button-on-outline" label="Status" value={statusLabel} />
            <Divider inset={theme.spacing.lg + 24 + theme.spacing.md} />
            <InfoRow icon="shield-checkmark-outline" label="Account" value={user.isVerified ? 'Verified Account' : 'Standard Account'} />
          </View>
        </View>

        {/* Shared media */}
        <Text style={[theme.textStyles.bodySmall, { color: theme.colors.textSecondary, fontWeight: theme.fontWeights.semibold, textTransform: 'uppercase', letterSpacing: theme.letterSpacing.wide, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xxl, paddingBottom: theme.spacing.sm }]}>
          Shared Media
        </Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {}}
          style={[styles.mediaRow, { backgroundColor: theme.colors.surfaceElevated, marginHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md }]}
          accessibilityRole="button"
          accessibilityLabel="View shared media"
        >
          <Ionicons name="images-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.text, flex: 1, marginLeft: theme.spacing.md }]}>Photos & Videos</Text>
          <Text style={[theme.textStyles.bodySmall, { color: theme.colors.textSecondary }]}>12</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} style={{ marginLeft: theme.spacing.xs }} />
        </TouchableOpacity>

        {/* Block */}
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xxl }}>
          <TouchableOpacity
            onPress={handleBlock}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isBlocked ? 'Unblock user' : 'Block user'}
            style={[
              styles.blockBtn,
              {
                backgroundColor: isBlocked ? theme.colors.secondary + '18' : theme.colors.error + '18',
                borderColor: isBlocked ? theme.colors.secondary + '40' : theme.colors.error + '40',
                borderRadius: theme.radius.md,
                paddingVertical: theme.spacing.md,
              },
            ]}
          >
            <Ionicons name={isBlocked ? 'checkmark-circle-outline' : 'ban-outline'} size={18} color={isBlocked ? theme.colors.secondary : theme.colors.error} />
            <Text style={[theme.textStyles.buttonMedium, { color: isBlocked ? theme.colors.secondary : theme.colors.error, marginLeft: theme.spacing.sm }]}>
              {isBlocked ? 'Unblock User' : 'Block User'}
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
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  heroNameRow: { flexDirection: 'row', alignItems: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'center' },
  actionBtn: { flex: 1, alignItems: 'center', maxWidth: 80 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 52 },
  infoText: { flex: 1 },
  mediaRow: { flexDirection: 'row', alignItems: 'center' },
  blockBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
