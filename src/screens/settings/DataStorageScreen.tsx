/**
 * Ma'lumotlar va xotira (Telegram Android'dagi "Data and Storage"):
 * xotira/trafik hajmi (TDLib), avto-yuklash qoidalari, proksi, bulutdagi qoralamalar.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT, type Translator } from '@/i18n';
import { td } from '@/services/tdlib/client';
import type { TdObject } from '@/services/tdlib/types';
import { formatBytes, getStorageFast } from '@/services/tdlib/storage';
import { getProxies } from '@/services/tdlib/proxy';
import { DEFAULT_PREFS, useUIStore, type AutoDownloadRule } from '@/stores/ui.store';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'DataStorage'>;
type Net = 'mobile' | 'wifi' | 'roaming';

/** "Rasmlar, Videolar (10 MB), Fayllar (1 MB)" */
export function autoDownloadSummary(t: Translator, rule: AutoDownloadRule): string {
  if (!rule.enabled) return t('data.auto.disabled');
  const parts: string[] = [];
  if (rule.photos) parts.push(t('data.auto.photos'));
  if (rule.videos) parts.push(`${t('data.auto.videos')} (${rule.videoMaxMb} MB)`);
  if (rule.files) parts.push(`${t('data.auto.files')} (${rule.fileMaxMb} MB)`);
  return parts.length > 0 ? parts.join(', ') : t('data.auto.noMedia');
}

interface NetStatsEntry {
  sent_bytes: number;
  received_bytes: number;
}

export function DataStorageScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const autoDownload = useUIStore((s) => s.autoDownload);
  const setPrefs = useUIStore((s) => s.setPrefs);
  const [storageSize, setStorageSize] = useState<number | null>(null);
  const [netSize, setNetSize] = useState<number | null>(null);
  const [proxy, setProxy] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getStorageFast()
        .then((s) => setStorageSize((s.files_size || 0) + (s.database_size || 0)))
        .catch(() => undefined);
      td<TdObject & { entries: NetStatsEntry[] }>({ '@type': 'getNetworkStatistics', only_current: false })
        .then((r) => setNetSize((r.entries ?? []).reduce((a, e) => a + (e.sent_bytes || 0) + (e.received_bytes || 0), 0)))
        .catch(() => undefined);
      getProxies()
        .then((list) => {
          const on = list.find((p) => p.is_enabled);
          setProxy(on ? `${on.proxy.server}:${on.proxy.port}` : '');
        })
        .catch(() => setProxy(''));
    }, []),
  );

  const setRule = (net: Net, patch: Partial<AutoDownloadRule>) =>
    setPrefs({ autoDownload: { ...autoDownload, [net]: { ...autoDownload[net], ...patch } } });

  const resetAuto = () =>
    showAlert(t('data.auto.resetTitle'), t('data.auto.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.auto.resetButton'),
        style: 'destructive',
        onPress: () => setPrefs({ autoDownload: DEFAULT_PREFS.autoDownload }),
      },
    ]);

  const clearDrafts = () =>
    showAlert(t('data.drafts.title'), t('data.drafts.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          td({ '@type': 'clearAllDraftMessages', exclude_secret_chats: false })
            .then(() => showAlert(t('data.drafts.title'), t('data.drafts.done')))
            .catch((e: Error) => showAlert(t('common.error'), e.message));
        },
      },
    ]);

  const nets: { key: Net; icon: string; color: string; label: string }[] = [
    { key: 'mobile', icon: 'cellular', color: '#3E9BEA', label: t('data.auto.mobile') },
    { key: 'wifi', icon: 'wifi', color: '#4FBC6B', label: t('data.auto.wifi') },
    { key: 'roaming', icon: 'globe', color: '#F2A23A', label: t('data.auto.roaming') },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('data.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsCard title={t('data.usageSection')}>
          <SettingsRow
            icon="pie-chart"
            color="#3E9BEA"
            label={t('data.storage.title')}
            value={storageSize === null ? undefined : formatBytes(storageSize)}
            onPress={() => navigation.navigate('Storage')}
          />
          <SettingsRow
            icon="stats-chart"
            color="#4FBC6B"
            label={t('data.usage.title')}
            value={netSize === null ? undefined : formatBytes(netSize)}
            onPress={() => navigation.navigate('DataUsage')}
            last
          />
        </SettingsCard>

        <SettingsCard title={t('data.auto.section')}>
          {nets.map((n) => {
            const rule = autoDownload[n.key];
            return (
              <SettingsRow
                key={n.key}
                icon={n.icon}
                color={n.color}
                label={n.label}
                subtitle={autoDownloadSummary(t, rule)}
                onPress={() => navigation.navigate('AutoDownload', { network: n.key })}
                right={
                  <Switch
                    value={rule.enabled}
                    onValueChange={(v) => setRule(n.key, { enabled: v })}
                    trackColor={{ true: c.primary, false: c.border }}
                    thumbColor="#FFFFFF"
                    style={{ marginLeft: 8 }}
                  />
                }
              />
            );
          })}
          <SettingsRow icon="refresh" label={t('data.auto.reset')} danger onPress={resetAuto} last />
        </SettingsCard>

        <SettingsCard title={t('data.proxy.section')}>
          <SettingsRow
            icon="shield-checkmark"
            color="#2CB9B0"
            label={t('data.proxy.settings')}
            value={proxy === null ? undefined : proxy || t('common.off')}
            onPress={() => navigation.navigate('Proxy')}
            last
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow icon="document-text" label={t('data.drafts.title')} danger onPress={clearDrafts} last />
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
