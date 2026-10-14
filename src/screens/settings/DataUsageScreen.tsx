/**
 * Trafik (Telegram'dagi "Data Usage"): getNetworkStatistics(only_current:false)
 * yozuvlari tarmoq turi (Mobil / Wi-Fi / Rouming) va toifalar bo'yicha.
 * fileTypeNone — fayl bo'lmagan trafik (xabarlar va h.k.), networkStatisticsEntryCall — qo'ng'iroqlar.
 * Eslatma: tarmoq turini TDLib'ga setNetworkType bildiradi (storage.ts → startNetworkSync).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { td } from '@/services/tdlib/client';
import type { TdObject } from '@/services/tdlib/types';
import { FILE_CATEGORIES, categoryOfFileType, formatBytes } from '@/services/tdlib/storage';
import { DonutChart, percentLabel } from '@/components/ui/DonutChart';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'DataUsage'>;
type Tab = 'all' | 'mobile' | 'wifi' | 'roaming';

interface Entry {
  '@type': 'networkStatisticsEntryFile' | 'networkStatisticsEntryCall';
  file_type?: { '@type': string };
  network_type: { '@type': string };
  sent_bytes: number;
  received_bytes: number;
  duration?: number;
}

interface NetStats extends TdObject {
  since_date: number;
  entries: Entry[];
}

/** Trafik toifalari: storage toifalari + xabarlar + qo'ng'iroqlar. */
const CATS: { key: string; color: string; icon: string }[] = [
  { key: 'messages', color: '#5AA9E6', icon: 'chatbubble' },
  ...FILE_CATEGORIES.filter((c) => c.key !== 'other').map((c) => ({ key: c.key as string, color: c.color, icon: c.icon })),
  { key: 'calls', color: '#1FA88C', icon: 'call' },
  { key: 'other', color: '#9AA4AF', icon: 'folder' },
];

function tabOf(networkType: string): Tab | null {
  if (networkType === 'networkTypeWiFi') return 'wifi';
  if (networkType === 'networkTypeMobile') return 'mobile';
  if (networkType === 'networkTypeMobileRoaming') return 'roaming';
  return null;
}

function catOf(e: Entry): string {
  if (e['@type'] === 'networkStatisticsEntryCall') return 'calls';
  const ft = e.file_type?.['@type'] ?? 'fileTypeNone';
  if (ft === 'fileTypeNone') return 'messages';
  return categoryOfFileType(ft);
}

export function DataUsageScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const [stats, setStats] = useState<NetStats | null>(null);
  const [tab, setTab] = useState<Tab>('all');

  const load = useCallback(() => {
    td<NetStats>({ '@type': 'getNetworkStatistics', only_current: false })
      .then(setStats)
      .catch((e: Error) => showAlert(t('common.error'), e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);

  const agg = useMemo(() => {
    const m = new Map<string, { sent: number; received: number }>();
    let sent = 0;
    let received = 0;
    for (const e of stats?.entries ?? []) {
      if (tab !== 'all' && tabOf(e.network_type?.['@type']) !== tab) continue;
      const k = catOf(e);
      const cur = m.get(k) ?? { sent: 0, received: 0 };
      cur.sent += e.sent_bytes || 0;
      cur.received += e.received_bytes || 0;
      m.set(k, cur);
      sent += e.sent_bytes || 0;
      received += e.received_bytes || 0;
    }
    return { m, sent, received, total: sent + received };
  }, [stats, tab]);

  const rows = CATS.map((def) => ({ def, v: agg.m.get(def.key) })).filter(
    (r): r is { def: (typeof CATS)[number]; v: { sent: number; received: number } } =>
      !!r.v && r.v.sent + r.v.received > 0,
  );

  const reset = () =>
    showAlert(t('data.usage.resetTitle'), t('data.usage.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('data.usage.resetButton'),
        style: 'destructive',
        onPress: () => {
          td({ '@type': 'resetNetworkStatistics' })
            .then(load)
            .catch((e: Error) => showAlert(t('common.error'), e.message));
        },
      },
    ]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: t('data.usage.all') },
    { key: 'mobile', label: t('data.usage.mobile') },
    { key: 'wifi', label: t('data.usage.wifi') },
    { key: 'roaming', label: t('data.usage.roaming') },
  ];

  const sinceText = (() => {
    if (!stats?.since_date) return undefined;
    const d = new Date(stats.since_date * 1000);
    const months = t('common.monthsLong').split(',');
    const date = `${d.getDate()} ${months[d.getMonth()] ?? ''} ${d.getFullYear()}`;
    return t('data.usage.since', { date });
  })();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('data.usage.title')} onBack={() => navigation.goBack()} />
      <View style={[styles.tabs, { backgroundColor: c.surface, borderBottomColor: c.border }]}>
        {tabs.map((x) => {
          const on = x.key === tab;
          return (
            <Pressable key={x.key} onPress={() => setTab(x.key)} style={styles.tab}>
              <Text style={[styles.tabText, { color: on ? c.primary : c.textSecondary }]} numberOfLines={1}>
                {x.label}
              </Text>
              <View style={[styles.tabLine, { backgroundColor: on ? c.primary : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {stats === null ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
        ) : (
          <>
            <View style={[styles.chartCard, { backgroundColor: c.surface }]}>
              <View style={{ paddingTop: 20 }}>
                <DonutChart
                  segments={rows.map((r) => ({ key: r.def.key, value: r.v.sent + r.v.received, color: r.def.color }))}
                  centerLabel={formatBytes(agg.total)}
                  centerSubLabel={agg.total === 0 ? t('data.usage.noData') : undefined}
                />
              </View>
              <Text style={[styles.chartSub, { color: c.textSecondary }]}>{sinceText}</Text>
            </View>

            {rows.length > 0 ? (
              <SettingsCard>
                {rows.map((r, i) => {
                  const v = r.v.sent + r.v.received;
                  return (
                    <SettingsRow
                      key={r.def.key}
                      icon={r.def.icon}
                      color={r.def.color}
                      label={`${t(`data.cat.${r.def.key}`)}  ${percentLabel(agg.total ? v / agg.total : 0)}`}
                      subtitle={t('data.usage.sentReceived', {
                        sent: formatBytes(r.v.sent),
                        received: formatBytes(r.v.received),
                      })}
                      value={formatBytes(v)}
                      last={i === rows.length - 1}
                    />
                  );
                })}
              </SettingsCard>
            ) : null}

            <SettingsCard title={t('data.usage.totalSection')}>
              <SettingsRow icon="arrow-up" color="#3E9BEA" label={t('data.usage.sent')} value={formatBytes(agg.sent)} />
              <SettingsRow
                icon="arrow-down"
                color="#4FBC6B"
                label={t('data.usage.received')}
                value={formatBytes(agg.received)}
                last
              />
            </SettingsCard>

            <SettingsCard footer={sinceText}>
              <SettingsRow icon="refresh" label={t('data.usage.resetButton')} danger onPress={reset} last />
            </SettingsCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12 },
  tabText: { fontSize: 14.5, fontWeight: '600', paddingHorizontal: 4 },
  tabLine: { height: 3, borderRadius: 2, alignSelf: 'stretch', marginHorizontal: 14, marginTop: 10 },
  chartCard: { marginHorizontal: 12, marginTop: 14, borderRadius: 14, overflow: 'hidden', paddingBottom: 16 },
  chartSub: { fontSize: 13.5, textAlign: 'center', marginTop: 14, marginHorizontal: 24, lineHeight: 18 },
});
