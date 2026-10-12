import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import Divider from '@/components/ui/Divider';
import type { SettingsStackParamList } from '@/types';
import { loadBlockedUsers, setUserBlocked } from '@/services/tdlib/chats';
import type { UserPreview } from '@/stores/chat.store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<SettingsStackParamList, 'BlockedUsers'>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
interface BlockedUserRowProps {
  user: UserPreview;
  onUnblock: (userId: string) => void;
  isLast: boolean;
}

const BlockedUserRow = React.memo(function BlockedUserRow({
  user,
  onUnblock,
  isLast,
}: BlockedUserRowProps) {
  const theme = useTheme();

  const fullName = `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`;

  const handleUnblock = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Unblock User',
      `Unblock ${fullName}? They will be able to message you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onUnblock(user.id);
          },
        },
      ]
    );
  }, [user.id, fullName, onUnblock]);

  return (
    <>
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            backgroundColor: theme.colors.surfaceElevated,
          },
        ]}
      >
        <Avatar uri={user.avatarUrl} name={fullName} size={46} />
        <View style={[styles.userInfo, { marginLeft: theme.spacing.md }]}>
          <Text
            style={[
              theme.textStyles.bodyMedium,
              { color: theme.colors.text, fontWeight: theme.fontWeights.semibold },
            ]}
            numberOfLines={1}
          >
            {fullName}
          </Text>
          {user.username != null && (
            <Text
              style={[
                theme.textStyles.bodySmall,
                { color: theme.colors.textSecondary, marginTop: 2 },
              ]}
              numberOfLines={1}
            >
              {user.username}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleUnblock}
          style={[
            styles.unblockButton,
            {
              backgroundColor: theme.colors.error + '1A',
              borderRadius: theme.radius.sm,
              paddingVertical: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Unblock ${fullName}`}
        >
          <Text
            style={[
              theme.textStyles.bodySmall,
              { color: theme.colors.error, fontWeight: theme.fontWeights.semibold },
            ]}
          >
            Unblock
          </Text>
        </TouchableOpacity>
      </View>
      {!isLast && <Divider inset={theme.spacing.lg + 46 + theme.spacing.md} />}
    </>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function BlockedUsersScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [blockedUsers, setBlockedUsers] = useState<UserPreview[]>([]);

  useEffect(() => {
    loadBlockedUsers().then(setBlockedUsers).catch(() => setBlockedUsers([]));
  }, []);

  const handleUnblock = useCallback((userId: string) => {
    setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
    void setUserBlocked(userId, false);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: UserPreview; index: number }) => (
      <BlockedUserRow
        user={item}
        onUnblock={handleUnblock}
        isLast={index === blockedUsers.length - 1}
      />
    ),
    [handleUnblock, blockedUsers.length]
  );

  const keyExtractor = useCallback((item: UserPreview) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text
          style={[
            theme.textStyles.headingSmall,
            { color: theme.colors.text, flex: 1, marginLeft: theme.spacing.sm },
          ]}
        >
          Blocked Users
        </Text>
        <Text
          style={[
            theme.textStyles.bodySmall,
            { color: theme.colors.textSecondary },
          ]}
        >
          {blockedUsers.length}
        </Text>
      </View>

      {blockedUsers.length === 0 ? (
        <EmptyState
          icon="🚫"
          title="No Blocked Users"
          subtitle="Users you block won't be able to message you"
        />
      ) : (
        <FlashList
          data={blockedUsers}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xl,
            paddingBottom: insets.bottom + theme.spacing.xxxl,
          }}
          ListHeaderComponent={
            <View
              style={{
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.md,
                overflow: 'hidden',
                marginBottom: theme.spacing.sm,
              }}
            />
          }
          ItemSeparatorComponent={null}
          showsVerticalScrollIndicator={false}
          getItemType={() => 'blocked-user'}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
  },
  userInfo: {
    flex: 1,
  },
  unblockButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
