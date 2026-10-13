/**
 * Chat papkalari: Telegram'dagi papkalaringiz (updateChatFolders) va
 * ulardagi chatlar soni. Papka yaratish/tahrirlash — keyingi bosqich.
 */
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useChatStore } from '@/stores/chat.store';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'ChatFolders'>;

export function ChatFoldersScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const folders = useChatStore((s) => s.folders);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title="Chat papkalari" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsCard
          title="Papkalarim"
          footer="Papkalar Telegram akkauntingizdan olinadi va chatlar ro'yxati tepasida tab bo'lib chiqadi. Yangi papka yaratish keyingi yangilanishda qo'shiladi."
        >
          <SettingsRow icon="chatbubbles" color="#3E9BEA" label="Barcha chatlar" last={folders.length === 0} />
          {folders.map((f, i) => (
            <SettingsRow
              key={f.id}
              icon="folder"
              color="#F59B2B"
              label={f.name}
              subtitle={f.unreadCount > 0 ? `${f.unreadCount} ta o'qilmagan` : undefined}
              last={i === folders.length - 1}
            />
          ))}
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
