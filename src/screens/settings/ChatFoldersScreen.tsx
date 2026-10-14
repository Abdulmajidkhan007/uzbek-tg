/**
 * Chat papkalari (Telegram uslubida): papkalar ro'yxati (updateChatFolders →
 * chat.store), yangi papka yaratish/tahrirlash, o'chirish va tavsiya
 * etilgan papkalar (getRecommendedChatFolders).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT, type Translator } from '@/i18n';
import { useChatStore } from '@/stores/chat.store';
import {
  createChatFolder,
  deleteChatFolder,
  folderTitle,
  getChatFolder,
  getRecommendedChatFolders,
  type TdChatFolder,
  type TdRecommendedChatFolder,
} from '@/services/tdlib/folders';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'ChatFolders'>;

/** Papka tavsifi: "Kontaktlar, Guruhlar" yoki "3 ta chat". */
export function folderSummary(t: Translator, f: TdChatFolder): string {
  const parts: string[] = [];
  if (f.include_contacts) parts.push(t('data.folders.typeContacts'));
  if (f.include_non_contacts) parts.push(t('data.folders.typeNonContacts'));
  if (f.include_groups) parts.push(t('data.folders.typeGroups'));
  if (f.include_channels) parts.push(t('data.folders.typeChannels'));
  if (f.include_bots) parts.push(t('data.folders.typeBots'));
  const n = new Set([...f.pinned_chat_ids, ...f.included_chat_ids]).size;
  if (n > 0) parts.push(t.p('data.folders.chats', n));
  return parts.length > 0 ? parts.join(', ') : t('data.folders.noChats');
}

export function ChatFoldersScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const folders = useChatStore((s) => s.folders);
  const [details, setDetails] = useState<Record<number, TdChatFolder>>({});
  const [recommended, setRecommended] = useState<TdRecommendedChatFolder[] | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  // Tahrirlash ekranidan qaytganda tafsilotlarni yangilash.
  useFocusEffect(useCallback(() => setTick((x) => x + 1), []));

  // Har bir papka tafsiloti (getChatFolder — mahalliy, tez).
  useEffect(() => {
    let alive = true;
    void Promise.all(
      folders.map((f) =>
        getChatFolder(f.id).then(
          (d) => [f.id, d] as const,
          () => null,
        ),
      ),
    ).then((pairs) => {
      if (!alive) return;
      const out: Record<number, TdChatFolder> = {};
      for (const p of pairs) if (p) out[p[0]] = p[1];
      setDetails(out);
    });
    return () => {
      alive = false;
    };
  }, [folders, tick]);

  const loadRecommended = useCallback(() => {
    getRecommendedChatFolders()
      .then(setRecommended)
      .catch(() => setRecommended([]));
  }, []);
  useEffect(loadRecommended, [loadRecommended, folders.length]);

  const remove = (id: number, name: string) =>
    showAlert(t('data.folders.deleteTitle'), t('data.folders.deleteConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteChatFolder(id).catch((e: Error) => showAlert(t('common.error'), e.message));
        },
      },
    ]);

  const menu = (id: number, name: string) =>
    showActionSheet({
      title: name,
      options: [
        { text: t('common.edit'), icon: 'create', onPress: () => navigation.navigate('ChatFolderEdit', { folderId: id }) },
        { text: t('common.delete'), icon: 'trash', destructive: true, onPress: () => remove(id, name) },
      ],
    });

  const addRecommended = (r: TdRecommendedChatFolder, i: number) => {
    setAdding(i);
    createChatFolder(r.folder)
      .then(() => setRecommended((prev) => (prev ? prev.filter((x) => x !== r) : prev)))
      .catch((e: Error) => showAlert(t('common.error'), e.message))
      .finally(() => setAdding(null));
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('data.folders.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: c.primary + '22' }]}>
            <Ionicons name="folder-open" size={64} color={c.primary} />
          </View>
          <Text style={[styles.heroText, { color: c.textSecondary }]}>{t('data.folders.hero')}</Text>
        </View>

        <SettingsCard title={t('data.folders.section')} footer={t('data.folders.footer')}>
          <SettingsRow icon="chatbubbles" color="#3E9BEA" label={t('data.folders.allChats')} />
          {folders.map((f) => {
            const d = details[f.id];
            return (
              <Pressable
                key={f.id}
                onPress={() => navigation.navigate('ChatFolderEdit', { folderId: f.id })}
                onLongPress={() => menu(f.id, f.name)}
                android_ripple={{ color: c.surfaceHighlight }}
              >
                <View pointerEvents="none">
                  <SettingsRow
                    icon="folder"
                    color="#F59B2B"
                    label={f.name}
                    subtitle={d ? folderSummary(t, d) : undefined}
                    right={<Ionicons name="chevron-forward" size={18} color={c.textTertiary} />}
                  />
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => navigation.navigate('ChatFolderEdit', {})}
            android_ripple={{ color: c.surfaceHighlight }}
            style={styles.createRow}
          >
            <Ionicons name="add-circle" size={28} color={c.primary} style={{ marginRight: 18 }} />
            <Text style={{ color: c.primary, fontSize: 16, fontWeight: '600' }}>{t('data.folders.create')}</Text>
          </Pressable>
        </SettingsCard>

        {recommended === null ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={c.primary} />
        ) : recommended.length > 0 ? (
          <SettingsCard title={t('data.folders.recommended')}>
            {recommended.map((r, i) => (
              <View
                key={`${folderTitle(r.folder)}-${i}`}
                style={[
                  styles.recRow,
                  i < recommended.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 16 }} numberOfLines={1}>
                    {folderTitle(r.folder)}
                  </Text>
                  {r.description ? (
                    <Text style={{ color: c.textSecondary, fontSize: 13.5, marginTop: 2 }} numberOfLines={2}>
                      {r.description}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={adding !== null ? undefined : () => addRecommended(r, i)}
                  style={[styles.addBtn, { backgroundColor: c.primary }]}
                >
                  {adding === i ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.addText}>{t('common.add')}</Text>
                  )}
                </Pressable>
              </View>
            ))}
          </SettingsCard>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 32 },
  heroIcon: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  heroText: { fontSize: 14.5, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  createRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 17, minHeight: 52 },
  recRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, minHeight: 56 },
  addBtn: { paddingHorizontal: 16, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 12, minWidth: 72 },
  addText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});
