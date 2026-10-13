/**
 * Ma'lumotlar va xotira: TDLib kesh hajmi (getStorageStatisticsFast) va
 * keshni tozalash (optimizeStorage). Xabarlar serverda qoladi.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { td } from '@/services/tdlib/client';
import type { TdObject } from '@/services/tdlib/types';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import { formatSize } from '@/components/chat/MediaContent';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'Storage'>;

interface Stats {
  files_size: number;
  file_count: number;
  database_size: number;
  log_size: number;
}

export function StorageScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    td<TdObject & Stats>({ '@type': 'getStorageStatisticsFast' })
      .then(setStats)
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const clear = () =>
    showAlert('Keshni tozalash', "Yuklab olingan rasm, video va fayllar telefondan o'chiriladi. Ular Telegram'da qoladi va kerak bo'lsa qayta yuklanadi.", [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Tozalash',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          td({
            '@type': 'optimizeStorage',
            size: 0,
            ttl: 0,
            count: 0,
            immunity_delay: 0,
            file_types: [],
            chat_ids: [],
            exclude_chat_ids: [],
            return_deleted_file_statistics: false,
            chat_limit: 0,
          })
            .then(load)
            .catch((e: Error) => showAlert('Xatolik', e.message))
            .finally(() => setBusy(false));
        },
      },
    ]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title="Ma'lumotlar va xotira" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {stats === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
        ) : (
          <SettingsCard
            title="Xotiradan foydalanish"
            footer="Kesh — siz ko'rgan media fayllar. Tozalasangiz xabarlar o'chmaydi."
          >
            <SettingsRow
              icon="images"
              color="#3E9BEA"
              label="Media va fayllar"
              subtitle={`${stats.file_count} ta fayl`}
              value={formatSize(stats.files_size) || '0 B'}
            />
            <SettingsRow
              icon="server"
              color="#9C6ADE"
              label="Ma'lumotlar bazasi"
              value={formatSize(stats.database_size) || '0 B'}
            />
            <SettingsRow
              icon={busy ? 'hourglass' : 'trash'}
              label={busy ? 'Tozalanmoqda...' : 'Keshni tozalash'}
              danger
              last
              onPress={busy ? undefined : clear}
            />
          </SettingsCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
