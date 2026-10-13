/**
 * Qurilmalar (faol seanslar): getActiveSessions, terminateSession,
 * terminateAllOtherSessions.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { td } from '@/services/tdlib/client';
import type { TdObject } from '@/services/tdlib/types';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'Sessions'>;

interface TdSession {
  id: string;
  is_current: boolean;
  application_name: string;
  application_version: string;
  device_model: string;
  platform: string;
  system_version: string;
  last_active_date: number;
  location: string;
  device_type: { '@type': string };
}

function deviceIcon(s: TdSession): { icon: string; color: string } {
  const t = s.device_type['@type'];
  if (t.includes('Android')) return { icon: 'logo-android', color: '#5DBB5A' };
  if (t.includes('Iphone') || t.includes('Ipad') || t.includes('Mac')) return { icon: 'logo-apple', color: '#8E99A4' };
  if (t.includes('Windows')) return { icon: 'logo-windows', color: '#3E9BEA' };
  if (t.includes('Linux')) return { icon: 'desktop', color: '#F59B2B' };
  if (t.includes('Chrome') || t.includes('Firefox') || t.includes('Safari') || t.includes('Edge') || t.includes('Brave'))
    return { icon: 'globe', color: '#3E9BEA' };
  return { icon: 'phone-portrait', color: '#9C6ADE' };
}

function describe(s: TdSession): string {
  const app = `${s.application_name} ${s.application_version}`.trim();
  const where = s.location ? ` • ${s.location}` : '';
  const when = s.is_current ? 'hozir faol' : format(new Date(s.last_active_date * 1000), 'dd.MM.yyyy HH:mm');
  return `${app}${where}\n${when}`;
}

export function SessionsScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const [sessions, setSessions] = useState<TdSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    td<TdObject & { sessions: TdSession[] }>({ '@type': 'getActiveSessions' })
      .then((r) => setSessions(r.sessions))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const terminate = (s: TdSession) =>
    showAlert('Seansni tugatish', `${s.device_model} qurilmasidagi seans tugatilsinmi?`, [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Tugatish',
        style: 'destructive',
        onPress: () =>
          td({ '@type': 'terminateSession', session_id: s.id })
            .then(load)
            .catch((e: Error) => showAlert('Xatolik', e.message)),
      },
    ]);

  const terminateOthers = () =>
    showAlert('Boshqa seanslar', "Shu qurilmadan boshqa barcha seanslar tugatilsinmi?", [
      { text: 'Bekor qilish', style: 'cancel' },
      {
        text: 'Tugatish',
        style: 'destructive',
        onPress: () =>
          td({ '@type': 'terminateAllOtherSessions' })
            .then(load)
            .catch((e: Error) => showAlert('Xatolik', e.message)),
      },
    ]);

  const current = sessions?.find((s) => s.is_current);
  const others = sessions?.filter((s) => !s.is_current) ?? [];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title="Qurilmalar" onBack={() => navigation.goBack()} />
      {sessions === null ? (
        error ? (
          <Text style={[styles.error, { color: c.error }]}>{error}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {current ? (
            <SettingsCard title="Shu qurilma">
              <SettingsRow
                {...deviceIcon(current)}
                label={current.device_model}
                subtitle={describe(current)}
                last={others.length === 0}
              />
              {others.length > 0 ? (
                <SettingsRow icon="hand-left" label="Boshqa seanslarni tugatish" danger last onPress={terminateOthers} />
              ) : null}
            </SettingsCard>
          ) : null}
          {others.length > 0 ? (
            <SettingsCard title="Faol seanslar" footer="Seansni tugatish uchun ustiga bosing.">
              {others.map((s, i) => (
                <SettingsRow
                  key={s.id}
                  {...deviceIcon(s)}
                  label={s.device_model}
                  subtitle={describe(s)}
                  last={i === others.length - 1}
                  onPress={() => terminate(s)}
                />
              ))}
            </SettingsCard>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  error: { margin: 24, fontSize: 15 },
});
