/**
 * Bloklangan foydalanuvchilar: getBlockedMessageSenders (loadBlockedUsers)
 * va blokdan chiqarish (setUserBlocked).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';

import * as Haptics from '@/utils/haptics';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import Avatar from '@/components/common/Avatar';
import EmptyState from '@/components/common/EmptyState';
import { SettingsCard } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';
import { loadBlockedUsers, setUserBlocked } from '@/services/tdlib/chats';
import type { UserPreview } from '@/stores/chat.store';

type Props = StackScreenProps<SettingsStackParamList, 'BlockedUsers'>;

function fullName(u: UserPreview): string {
  return `${u.firstName}${u.lastName ? ` ${u.lastName}` : ''}`.trim();
}

function BlockedRow({
  user,
  last,
  onUnblock,
}: {
  user: UserPreview;
  last: boolean;
  onUnblock: (u: UserPreview) => void;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const name = fullName(user);
  return (
    <View style={styles.row}>
      <Avatar uri={user.avatarUrl} name={name || '?'} size={44} />
      <View
        style={[styles.rowBody, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {name}
          </Text>
          {user.username ? (
            <Text style={[styles.username, { color: c.textSecondary }]} numberOfLines={1}>
              @{user.username}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => onUnblock(user)}
          hitSlop={6}
          style={[styles.unblock, { backgroundColor: c.error + '1A' }]}
          accessibilityRole="button"
        >
          <Text style={[styles.unblockText, { color: c.error }]}>{t('settings.blocked.unblock')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function BlockedUsersScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const [users, setUsers] = useState<UserPreview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    loadBlockedUsers()
      .then((u) => {
        setUsers(u);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const unblock = useCallback(
    (u: UserPreview) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showAlert(t('settings.blocked.unblock'), t('settings.blocked.unblockConfirm', { name: fullName(u) }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.blocked.unblock'),
          style: 'destructive',
          onPress: () => {
            setUsers((prev) => prev?.filter((x) => x.id !== u.id) ?? prev);
            setUserBlocked(u.id, false).catch((e: Error) => {
              showAlert(t('common.error'), e.message);
              load();
            });
          },
        },
      ]);
    },
    [t, load],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('settings.blocked.title')} onBack={() => navigation.goBack()} />
      {users === null ? (
        error ? (
          <Text style={[styles.error, { color: c.error }]}>{`${t('settings.privacy.loadError')}: ${error}`}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
        )
      ) : users.length === 0 ? (
        <EmptyState icon="🚫" title={t('settings.blocked.empty')} subtitle={t('settings.blocked.emptySub')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <SettingsCard footer={t('settings.blocked.footer')}>
            {users.map((u, i) => (
              <BlockedRow key={u.id} user={u} last={i === users.length - 1} onUnblock={unblock} />
            ))}
          </SettingsCard>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  error: { margin: 24, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 64, marginLeft: 14, paddingRight: 14 },
  name: { fontSize: 16, fontWeight: '500' },
  username: { fontSize: 14, marginTop: 2 },
  unblock: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, marginLeft: 8 },
  unblockText: { fontSize: 14, fontWeight: '600' },
});
