/**
 * Kanal ma'lumoti: nom, obunachilar soni, tavsif, havola, muhokama guruhi,
 * umumiy media sonlari, ovozsiz qilish, qo'shilish / chiqish, ulashish.
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
import { useChatStore } from '@/stores/chat.store';
import { chatById, deleteChat, loadChatInfo, setChatJoined, setChatMuted, type ChatInfo } from '@/services/tdlib/chats';
import type { ChatStackParamList } from '@/navigation/types';
import { showAlert } from '@/components/ui/Dialog';
import { ActionButton, InfoRow, SharedMediaSection } from '@/components/chat/InfoBlocks';

type Props = StackScreenProps<ChatStackParamList, 'ChannelInfo'>;

export function ChannelInfoScreen({ route, navigation }: Props): React.JSX.Element {
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
  const reload = useCallback(() => {
    loadChatInfo(chatId).then(setInfo).catch(() => undefined);
  }, [chatId]);
  useEffect(reload, [reload]);

  const fail = (e: unknown) => showAlert(t('chat.actionFailed'), e instanceof Error ? e.message : String(e));

  const handleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatMuted(chatId, !(chat?.isMuted ?? false)).catch(fail);
  }, [chatId, chat?.isMuted]);

  const handleJoin = useCallback(() => {
    setChatJoined(chatId, true).then(reload).catch(fail);
  }, [chatId, reload]);

  const handleLeave = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showAlert(t('chat.leaveChannel'), t('chat.leaveConfirm', { name: chat?.name ?? '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.leave'),
        style: 'destructive',
        onPress: () =>
          deleteChat(chatId)
            .then(() => navigation.popToTop())
            .catch(fail),
      },
    ]);
  }, [chat, chatId, navigation]);

  const link = info?.username ? `https://t.me/${info.username}` : info?.inviteLink;

  const handleShare = useCallback(() => {
    if (!link) return;
    Share.share({ message: link, title: chat?.name }).catch(() => undefined);
  }, [link, chat?.name]);

  const openDiscussion = useCallback(() => {
    if (!info?.linkedChatId) return;
    chatById(info.linkedChatId)
      .then((c) => c && navigation.push('ChatDetail', { chatId: c.id, chatType: c.type, title: c.name, avatarUrl: c.avatarUrl }))
      .catch(fail);
  }, [info?.linkedChatId, navigation]);

  if (!chat) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.textSecondary }]}>{tr('chat.info.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const count = info?.memberCount ?? chat.memberCount;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={tr('chat.goBack')}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[theme.textStyles.headingSmall, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
          {tr('chat.info.channelTitle')}
        </Text>
        {link ? (
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={tr('common.share')}>
            <Ionicons name="share-social-outline" size={22} color={theme.colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.hero, { backgroundColor: theme.colors.surface }]}>
          <Avatar uri={chat.avatarUrl} name={chat.name} size={84} />
          <Text style={[theme.textStyles.headingMedium, { color: theme.colors.text, marginTop: 12, textAlign: 'center' }]}>{chat.name}</Text>
          <Text style={[theme.textStyles.bodySmall, { color: theme.colors.textSecondary, marginTop: 4 }]}>
            {count ? tr.p('chat.subscribers', count) : tr('chat.channel')}
          </Text>
          <View style={styles.actionsRow}>
            {info && !info.isMember ? (
              <ActionButton icon="add-circle-outline" label={tr('chat.join')} onPress={handleJoin} />
            ) : (
              <ActionButton
                icon={chat.isMuted ? 'notifications-off-outline' : 'notifications-outline'}
                label={chat.isMuted ? tr('chat.unmute') : tr('chat.mute')}
                onPress={handleMute}
              />
            )}
            {link ? <ActionButton icon="share-social-outline" label={tr('common.share')} onPress={handleShare} /> : null}
            {info?.isMember ? (
              <ActionButton icon="exit-outline" label={tr('chat.leave')} onPress={handleLeave} color={theme.colors.error} />
            ) : null}
          </View>
        </View>

        {info?.description || link || info?.linkedChatId ? (
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
            {info?.linkedChatId ? (
              <InfoRow icon="chatbubbles-outline" label={tr('chat.info.discussion')} value={tr('chat.info.open')} onPress={openDiscussion} />
            ) : null}
          </View>
        ) : null}

        <SharedMediaSection chatId={chatId} />
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
