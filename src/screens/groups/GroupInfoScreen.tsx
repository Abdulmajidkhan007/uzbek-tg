/**
 * Guruh ma'lumoti: nom, a'zolar soni, tavsif, havola, a'zolar (admin/egasi
 * belgisi bilan), umumiy media sonlari, ovozsiz qilish, guruhdan chiqish.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useT, t } from '@/i18n';
import Avatar from '@/components/common/Avatar';
import { useChatStore, type UserPreview } from '@/stores/chat.store';
import { deleteChat, loadAdmins, loadChatInfo, loadMembers, setChatMuted, type ChatInfo } from '@/services/tdlib/chats';
import type { ChatStackParamList } from '@/navigation/types';
import { showAlert } from '@/components/ui/Dialog';
import { ActionButton, InfoRow, MemberRow, SectionTitle, SharedMediaSection } from '@/components/chat/InfoBlocks';

type Props = StackScreenProps<ChatStackParamList, 'GroupInfo'>;

export function GroupInfoScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const tr = useT();
  const { chatId } = route.params;

  const chat = useChatStore(
    useCallback(
      (s) => s.chats.find((c) => c.id === chatId) ?? Object.values(s.listChats).flat().find((c) => c.id === chatId) ?? null,
      [chatId],
    ),
  );

  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [members, setMembers] = useState<UserPreview[]>([]);
  const [admins, setAdmins] = useState<Map<string, { owner: boolean; title: string }>>(new Map());

  useEffect(() => {
    loadChatInfo(chatId).then(setInfo).catch(() => undefined);
    loadMembers(chatId).then(setMembers).catch(() => setMembers([]));
    loadAdmins(chatId).then(setAdmins).catch(() => undefined);
  }, [chatId]);

  const sortedMembers = useMemo(() => {
    const rank = (m: UserPreview) => (admins.get(m.id)?.owner ? 0 : admins.has(m.id) ? 1 : 2);
    return [...members].sort((a, b) => rank(a) - rank(b));
  }, [members, admins]);

  const handleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatMuted(chatId, !(chat?.isMuted ?? false)).catch((e: unknown) =>
      showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e)),
    );
  }, [chatId, chat?.isMuted]);

  const handleLeave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showAlert(t('chat.leaveGroup'), t('chat.leaveConfirm', { name: chat?.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.leave'),
        style: 'destructive',
        onPress: () =>
          deleteChat(chatId)
            .then(() => navigation.popToTop())
            .catch((e: unknown) => showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e))),
      },
    ]);
  }, [chat, chatId, navigation]);

  if (!chat) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.textSecondary }]}>{tr('chat.info.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const count = info?.memberCount ?? chat.memberCount ?? members.length;
  const link = info?.username ? `https://t.me/${info.username}` : info?.inviteLink;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={tr('chat.goBack')}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[theme.textStyles.headingSmall, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
          {tr('chat.info.groupTitle')}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.hero, { backgroundColor: theme.colors.surface }]}>
          <Avatar uri={chat.avatarUrl} name={chat.name} size={84} />
          <Text style={[theme.textStyles.headingMedium, { color: theme.colors.text, marginTop: 12, textAlign: 'center' }]}>{chat.name}</Text>
          <Text style={[theme.textStyles.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}>
            {count ? tr.p('chat.members', count) : tr('chat.group')}
          </Text>
          <View style={styles.actionsRow}>
            <ActionButton
              icon={chat.isMuted ? 'notifications-off-outline' : 'notifications-outline'}
              label={chat.isMuted ? tr('chat.unmute') : tr('chat.mute')}
              onPress={handleMute}
            />
            {info?.isMember !== false ? (
              <ActionButton icon="exit-outline" label={tr('chat.leave')} onPress={handleLeave} color={theme.colors.error} />
            ) : null}
          </View>
        </View>

        {info?.description || link ? (
          <View style={{ marginTop: 8 }}>
            {info?.description ? <InfoRow icon="information-circle-outline" label={tr('chat.info.description')} value={info.description} /> : null}
            {link ? (
              <InfoRow
                icon="link-outline"
                label={info?.username ? tr('chat.info.link') : tr('chat.info.inviteLink')}
                value={link.replace(/^https:\/\//, '')}
                onPress={() => Linking.openURL(link).catch(() => undefined)}
              />
            ) : null}
          </View>
        ) : null}

        <SharedMediaSection chatId={chatId} />

        {sortedMembers.length > 0 ? (
          <View>
            <SectionTitle title={count ? tr.p('chat.members', count) : tr('chat.info.members')} />
            {sortedMembers.map((m) => {
              const a = admins.get(m.id);
              return (
                <MemberRow
                  key={m.id}
                  member={m}
                  role={a ? a.title || (a.owner ? tr('chat.info.owner') : tr('chat.info.admin')) : undefined}
                  onPress={() => navigation.navigate('Profile', { userId: m.id })}
                />
              );
            })}
          </View>
        ) : null}
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
