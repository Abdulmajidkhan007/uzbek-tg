/**
 * Qurilmalar (faol seanslar), Telegram uslubida: getActiveSessions,
 * terminateSession, terminateAllOtherSessions, setInactiveSessionTtl.
 * QR orqali yangi qurilma ulash hozircha yo'q — shuning uchun "Qurilma qo'shish"
 * tugmasi ko'rsatilmaydi.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format, isSameDay } from 'date-fns';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { shortWeekdays, useT, type Translator } from '@/i18n';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';
import {
  errorText,
  formatDays,
  getSessions,
  setInactiveSessionTtl,
  terminateOtherSessions,
  terminateSession,
  type TdSession,
} from '@/services/tdlib/settings';

type Props = StackScreenProps<SettingsStackParamList, 'Sessions'>;

const TTL_OPTIONS = [7, 30, 90, 180, 365];

function deviceIcon(s: TdSession): { icon: string; color: string } {
  const type = s.device_type['@type'];
  switch (type) {
    case 'sessionDeviceTypeAndroid':
      return { icon: 'logo-android', color: '#5DBB5A' };
    case 'sessionDeviceTypeIphone':
    case 'sessionDeviceTypeIpad':
    case 'sessionDeviceTypeMac':
    case 'sessionDeviceTypeApple':
      return { icon: 'logo-apple', color: '#8E99A4' };
    case 'sessionDeviceTypeWindows':
      return { icon: 'logo-windows', color: '#3E9BEA' };
    case 'sessionDeviceTypeLinux':
    case 'sessionDeviceTypeUbuntu':
      return { icon: 'logo-tux', color: '#F59B2B' };
    case 'sessionDeviceTypeXbox':
      return { icon: 'logo-xbox', color: '#5DBB5A' };
    case 'sessionDeviceTypeChrome':
      return { icon: 'logo-chrome', color: '#E5574F' };
    case 'sessionDeviceTypeFirefox':
      return { icon: 'logo-firefox', color: '#F59B2B' };
    case 'sessionDeviceTypeEdge':
      return { icon: 'logo-edge', color: '#3E9BEA' };
    case 'sessionDeviceTypeSafari':
    case 'sessionDeviceTypeBrave':
    case 'sessionDeviceTypeOpera':
    case 'sessionDeviceTypeVivaldi':
      return { icon: 'globe', color: '#3E9BEA' };
    default:
      return { icon: 'phone-portrait', color: '#9C6ADE' };
  }
}

function lastActive(s: TdSession, t: Translator): string {
  if (s.is_current) return t('common.online');
  const d = new Date(s.last_active_date * 1000);
  const now = new Date();
  if (isSameDay(d, now)) return format(d, 'HH:mm');
  if (now.getTime() - d.getTime() < 6 * 86400 * 1000) return shortWeekdays(t.lang)[d.getDay()] ?? format(d, 'dd.MM.yy');
  return format(d, 'dd.MM.yy');
}

function title(s: TdSession): string {
  return s.device_model || `${s.platform} ${s.system_version}`.trim() || s.application_name;
}

function subtitle(s: TdSession, t: Translator): string {
  const app = `${s.application_name} ${s.application_version}`.trim();
  const where = [s.location, lastActive(s, t)].filter(Boolean).join(' • ');
  return `${app}\n${where}`;
}

export function SessionsScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const [sessions, setSessions] = useState<TdSession[] | null>(null);
  const [ttlDays, setTtlDays] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getSessions()
      .then((r) => {
        setSessions(r.sessions);
        setTtlDays(r.ttlDays);
        setError(null);
      })
      .catch((e) => setError(errorText(e)));
  }, []);

  useEffect(load, [load]);

  const confirmTerminate = (s: TdSession) =>
    showAlert(t('settings.sessions.terminate'), t('settings.sessions.terminateConfirm', { device: title(s) }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.sessions.terminate'),
        style: 'destructive',
        onPress: () =>
          terminateSession(s.id)
            .then(load)
            .catch((e) => showAlert(t('common.error'), errorText(e))),
      },
    ]);

  const showDetails = (s: TdSession) => {
    const lines = [
      `${t('settings.sessions.application')}: ${s.application_name} ${s.application_version}`.trim(),
      `${s.platform} ${s.system_version}`.trim(),
      s.location ? `${t('settings.sessions.location')}: ${s.location}` : '',
      s.ip_address ? `${t('settings.sessions.ip')}: ${s.ip_address}` : '',
      `${t('settings.sessions.loggedIn')}: ${format(new Date(s.log_in_date * 1000), 'dd.MM.yyyy HH:mm')}`,
      `${t('settings.sessions.lastActive')}: ${
        s.is_current ? t('common.online') : format(new Date(s.last_active_date * 1000), 'dd.MM.yyyy HH:mm')
      }`,
      s.is_unconfirmed ? t('settings.sessions.unconfirmed') : '',
    ].filter(Boolean);
    showAlert(
      title(s),
      lines.join('\n'),
      s.is_current
        ? [{ text: t('common.close') }]
        : [
            { text: t('common.close'), style: 'cancel' },
            { text: t('settings.sessions.terminate'), style: 'destructive', onPress: () => confirmTerminate(s) },
          ],
    );
  };

  const terminateOthers = () =>
    showAlert(t('settings.sessions.terminateOthers'), t('settings.sessions.terminateOthersConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.sessions.terminateOthers'),
        style: 'destructive',
        onPress: () =>
          terminateOtherSessions()
            .then(load)
            .catch((e) => showAlert(t('common.error'), errorText(e))),
      },
    ]);

  const pickTtl = () =>
    showActionSheet({
      title: t('settings.sessions.autoTerminate'),
      options: TTL_OPTIONS.map((d) => ({
        text: formatDays(d, t.p) + (d === ttlDays ? '  ✓' : ''),
        onPress: () => {
          const prev = ttlDays;
          setTtlDays(d);
          setInactiveSessionTtl(d).catch((e) => {
            setTtlDays(prev);
            showAlert(t('common.error'), errorText(e));
          });
        },
      })),
    });

  const current = sessions?.find((s) => s.is_current);
  const others = (sessions ?? [])
    .filter((s) => !s.is_current)
    .sort((a, b) => b.last_active_date - a.last_active_date);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('settings.sessions.title')} onBack={() => navigation.goBack()} />
      {sessions === null ? (
        error ? (
          <Text style={[styles.error, { color: c.error }]}>{`${t('settings.privacy.loadError')}: ${error}`}</Text>
        ) : (
          <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[styles.hero, { backgroundColor: c.surface }]}>
            <Ionicons name="laptop-outline" size={84} color={c.primary} />
            <Text style={[styles.heroText, { color: c.text }]}>{t('settings.sessions.hero')}</Text>
            <Text style={[styles.heroNote, { color: c.textSecondary }]}>{t('settings.sessions.qrSoon')}</Text>
          </View>

          {current ? (
            <SettingsCard
              title={t('settings.sessions.thisDevice')}
              footer={others.length > 0 ? t('settings.sessions.terminateOthersFooter') : undefined}
            >
              <SettingsRow
                {...deviceIcon(current)}
                label={title(current)}
                subtitle={subtitle(current, t)}
                onPress={() => showDetails(current)}
                last={others.length === 0}
              />
              {others.length > 0 ? (
                <SettingsRow
                  icon="hand-left"
                  label={t('settings.sessions.terminateOthers')}
                  danger
                  last
                  onPress={terminateOthers}
                />
              ) : null}
            </SettingsCard>
          ) : null}

          {others.length > 0 ? (
            <SettingsCard title={t('settings.sessions.active')} footer={t('settings.sessions.activeFooter')}>
              {others.map((s, i) => (
                <SettingsRow
                  key={s.id}
                  {...deviceIcon(s)}
                  label={title(s)}
                  subtitle={subtitle(s, t)}
                  last={i === others.length - 1}
                  onPress={() => showDetails(s)}
                />
              ))}
            </SettingsCard>
          ) : null}

          {ttlDays !== null ? (
            <SettingsCard title={t('settings.sessions.autoTerminate')} footer={t('settings.sessions.ifInactiveFooter')}>
              <SettingsRow
                icon="time"
                color="#8E99A4"
                label={t('settings.sessions.ifInactive')}
                value={formatDays(ttlDays, t.p)}
                onPress={pickTtl}
                last
              />
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
  hero: {
    marginHorizontal: 12,
    marginTop: 14,
    borderRadius: 14,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
  },
  heroText: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  heroNote: { fontSize: 13, textAlign: 'center', marginTop: 6 },
});
