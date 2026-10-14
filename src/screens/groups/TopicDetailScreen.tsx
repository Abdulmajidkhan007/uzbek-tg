/**
 * Forum mavzusi: getForumTopicHistory orqali xabarlar va mavzuga matn yuborish.
 * (Hozircha jonli yangilanish yo'q — yuborilgandan keyin tarix qayta yuklanadi.)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useT, t } from '@/i18n';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';
import MessageBubble from '@/components/chat/MessageBubble';
import MessageInput from '@/components/chat/MessageInput';
import { ChatBackground } from '@/components/chat/ChatBackground';
import { ServicePill } from '@/components/chat/ServiceMessage';
import { chatName, loadTopicHistory, sendTopicText } from '@/services/tdlib/chats';
import { showAlert } from '@/components/ui/Dialog';
import type { ChatStackParamList } from '@/navigation/types';
import type { ChatMessage } from '@/stores/chat.store';

type Props = StackScreenProps<ChatStackParamList, 'TopicDetail'>;

export function TopicDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const tr = useT();
  const { chatId, topicId, topicTitle } = route.params;

  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const reload = useCallback(() => {
    return loadTopicHistory(chatId, topicId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setIsLoading(false));
  }, [chatId, topicId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const data = useMemo(() => [...messages].reverse(), [messages]);

  const handleSendText = useCallback(
    (text: string) => {
      sendTopicText(chatId, topicId, text)
        .then(() => setTimeout(() => void reload(), 400))
        .catch((e: unknown) => showAlert(t('chat.sendError'), e instanceof Error ? e.message : String(e)));
    },
    [chatId, topicId, reload],
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) =>
      item.isService ? (
        <ServicePill text={item.text ?? ''} />
      ) : (
        <MessageBubble message={item} isOwn={item.senderId === 'me'} showSender={item.senderId !== 'me'} />
      ),
    [],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={tr('chat.goBack')}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[theme.textStyles.chatName, { color: theme.colors.text }]} numberOfLines={1}>
            {topicTitle}
          </Text>
          <Text style={[theme.textStyles.caption, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {tr('chat.topic.in', { name: chatName(chatId) })}
          </Text>
        </View>
      </View>

      <View style={styles.flex}>
        <ChatBackground />
        {isLoading ? (
          <LoadingState message={tr('chat.loadingMessages')} />
        ) : (
          <FlashList
            data={data}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: theme.spacing.sm }}
            ListEmptyComponent={
              <View style={{ minHeight: 400 }}>
                <EmptyState icon="💬" title={tr("chat.topic.empty")} />
              </View>
            }
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      <MessageInput chatId={chatId} replyingTo={null} onSendText={handleSendText} onCancelReply={() => undefined} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', height: 56, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, marginLeft: 4 },
});
