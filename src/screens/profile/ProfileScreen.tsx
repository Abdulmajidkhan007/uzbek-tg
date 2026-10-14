/**
 * Boshqa foydalanuvchi profili: getUser + getUserFullInfo (bio, telefon,
 * username, umumiy guruhlar), xabar yozish, ulashish, bloklash, umumiy media.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useT, t } from '@/i18n';
import Avatar from '@/components/common/Avatar';
import LoadingState from '@/components/common/LoadingState';
import { useChatStore } from '@/stores/chat.store';
import { loadUserProfile, openPrivateChat, setUserBlocked, type UserProfile } from '@/services/tdlib/chats';
import type { ChatStackParamList } from '@/navigation/types';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import { ActionButton, InfoRow, SharedMediaSection } from '@/components/chat/InfoBlocks';
import { userStatusLabel } from '@/components/chat/chatFormat';

type Props = StackScreenProps<ChatStackParamList, 'Profile'>;

export function ProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const tr = useT();
  const { userId } = route.params;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  // Shaxsiy chat (bo'lsa) — umumiy media soni uchun.
  const privateChatId = useChatStore((s) => s.chats.find((c) => c.type === 'private' && c.otherUser?.id === userId)?.id);

  useEffect(() => {
    loadUserProfile(userId)
      .then((p) => {
        setProfile(p);
        setIsBlocked(p?.isBlocked ?? false);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [userId]);

  const user = profile?.user;
  const fullName = user ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : '';

  const handleMessage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openPrivateChat(userId)
      .then((chat) => navigation.navigate('ChatDetail', { chatId: chat.id, chatType: chat.type, title: chat.name, avatarUrl: chat.avatarUrl }))
      .catch((e: unknown) => showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e)));
  }, [userId, navigation]);

  const handleShare = useCallback(() => {
    if (!user?.username) return;
    Share.share({ message: `https://t.me/${user.username}`, title: fullName }).catch(() => undefined);
  }, [user, fullName]);

  const handleBlock = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = !isBlocked;
    showAlert(
      next ? t('chat.info.block') : t('chat.info.unblock'),
      next ? t('chat.info.blockConfirm', { name: fullName }) : t('chat.info.unblockConfirm', { name: fullName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: next ? t('chat.info.block') : t('chat.info.unblock'),
          style: next ? 'destructive' : 'default',
          onPress: () =>
            setUserBlocked(userId, next)
              .then(() => setIsBlocked(next))
              .catch((e: unknown) => showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e))),
        },
      ],
    );
  }, [isBlocked, fullName, userId]);

  const handleMore = useCallback(() => {
    const options = [];
    if (user?.username) options.push({ text: t('common.share'), icon: 'share-social-outline', onPress: handleShare });
    options.push(
      isBlocked
        ? { text: t('chat.info.unblock'), icon: 'lock-open-outline', onPress: handleBlock }
        : { text: t('chat.info.block'), icon: 'hand-left-outline', destructive: true, onPress: handleBlock },
    );
    showActionSheet({ title: fullName, options });
  }, [user, isBlocked, fullName, handleShare, handleBlock]);

  const headerBar = (
    <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={tr('chat.goBack')}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
      </TouchableOpacity>
      <Text style={[theme.textStyles.headingSmall, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
        {tr('chat.info.profileTitle')}
      </Text>
      {user ? (
        <TouchableOpacity onPress={handleMore} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={tr('chat.moreOptions')}>
          <Ionicons name="ellipsis-vertical" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (loading || !user || !profile) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {headerBar}
        {loading ? (
          <LoadingState message={tr('common.loading')} />
        ) : (
          <View style={styles.centered}>
            <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.textSecondary }]}>{tr('chat.info.userNotFound')}</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const online = user.status === 'online';
  const phone = profile.phone ? `+${profile.phone.replace(/^\+/, '')}` : '';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
      {headerBar}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.hero, { backgroundColor: theme.colors.surface }]}>
          <Avatar uri={user.avatarUrl} name={fullName} size={88} showOnline isOnline={online} />
          <Text style={[theme.textStyles.headingMedium, { color: theme.colors.text, marginTop: 12, textAlign: 'center' }]}>{fullName}</Text>
          <Text style={[theme.textStyles.bodySmall, { color: online ? theme.colors.primary : theme.colors.textSecondary, marginTop: 4 }]}>
            {userStatusLabel(tr, user)}
          </Text>
          <View style={styles.actionsRow}>
            <ActionButton icon="chatbubble-outline" label={tr('chat.info.sendMessage')} onPress={handleMessage} />
            {user.username ? <ActionButton icon="share-social-outline" label={tr('common.share')} onPress={handleShare} /> : null}
            <ActionButton
              icon={isBlocked ? 'lock-open-outline' : 'hand-left-outline'}
              label={isBlocked ? tr('chat.info.unblock') : tr('chat.info.block')}
              onPress={handleBlock}
              color={isBlocked ? undefined : theme.colors.error}
            />
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          {phone ? (
            <InfoRow
              icon="call-outline"
              label={tr('chat.info.phone')}
              value={phone}
              onPress={() => Linking.openURL(`tel:${phone}`).catch(() => undefined)}
            />
          ) : null}
          {profile.bio ? <InfoRow icon="information-circle-outline" label={tr('chat.info.bio')} value={profile.bio} /> : null}
          {user.username ? <InfoRow icon="at-outline" label={tr('chat.info.username')} value={`@${user.username}`} /> : null}
          {profile.commonGroups > 0 ? (
            <InfoRow icon="people-outline" label={tr('chat.info.commonGroupsLabel')} value={tr.p('chat.info.commonGroups', profile.commonGroups)} />
          ) : null}
        </View>

        {privateChatId ? <SharedMediaSection chatId={privateChatId} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 16 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18, alignSelf: 'stretch' },
});
