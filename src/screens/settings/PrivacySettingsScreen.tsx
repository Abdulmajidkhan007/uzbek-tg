/**
 * Maxfiylik va xavfsizlik (Telegram Android'dagi kabi). Barcha qiymatlar
 * TDLib'dan: getUserPrivacySettingRules, getPasswordState,
 * getDefaultMessageAutoDeleteTime, getActiveSessions, getBlockedMessageSenders,
 * getAccountTtl.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useT, type Translator } from '@/i18n';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import type { PrivacySettingKey, SettingsStackParamList } from '@/navigation/types';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore, type Prefs } from '@/stores/ui.store';
import {
  errorText,
  formatDays,
  formatSeconds,
  getAccountTtl,
  getBlockedCount,
  getDefaultAutoDelete,
  getPasswordState,
  getNewChatsFromUnknown,
  getPrivacyRules,
  getSessions,
  setNewChatsFromUnknown,
  setAccountTtl,
  setDefaultAutoDelete,
  summarizeRules,
  type PrivacySummary,
} from '@/services/tdlib/settings';

type Props = StackScreenProps<SettingsStackParamList, 'PrivacySettings'>;

const PRIVACY_ROWS: { key: PrivacySettingKey; label: string; icon: string; color: string; premium?: boolean }[] = [
  { key: 'showPhoneNumber', label: 'settings.privacy.phone', icon: 'call', color: '#5DBB5A' },
  { key: 'showStatus', label: 'settings.privacy.lastSeen', icon: 'time', color: '#3E9BEA' },
  { key: 'showProfilePhoto', label: 'settings.privacy.photos', icon: 'person-circle', color: '#E5574F' },
  { key: 'showLinkInForwardedMessages', label: 'settings.privacy.forwards', icon: 'arrow-redo', color: '#3E9BEA' },
  { key: 'allowCalls', label: 'settings.privacy.calls', icon: 'call-outline', color: '#5DBB5A' },
  { key: 'allowPrivateVoiceAndVideoNoteMessages', label: 'settings.privacy.voice', icon: 'mic', color: '#9C6ADE', premium: true },
];

/** "Xabarlar" qatoridan keyingi qatorlar (Telegram tartibi). */
const PRIVACY_ROWS_2: { key: PrivacySettingKey; label: string; icon: string; color: string }[] = [
  { key: 'showBirthdate', label: 'settings.privacy.birthdate', icon: 'gift', color: '#E05C9C' },
  { key: 'showBio', label: 'settings.privacy.bio', icon: 'information-circle', color: '#F59B2B' },
  { key: 'showProfileAudio', label: 'settings.privacy.savedMusic', icon: 'musical-notes', color: '#E5574F' },
  { key: 'allowChatInvites', label: 'settings.privacy.invites', icon: 'people', color: '#F59B2B' },
];

const GHOST_ROWS: { key: 'ghostRead' | 'ghostOnline' | 'ghostTyping' | 'ghostStories'; label: string; icon: string; color: string }[] = [
  { key: 'ghostRead', label: 'settings.ghost.read', icon: 'checkmark-done', color: '#3E9BEA' },
  { key: 'ghostOnline', label: 'settings.ghost.online', icon: 'radio-button-on', color: '#5DBB5A' },
  { key: 'ghostTyping', label: 'settings.ghost.typing', icon: 'create', color: '#F59B2B' },
  { key: 'ghostStories', label: 'settings.ghost.stories', icon: 'aperture', color: '#9C6ADE' },
];

const AUTO_DELETE_OPTIONS = [0, 86400, 7 * 86400, 31 * 86400];
const ACCOUNT_TTL_OPTIONS = [30, 90, 180, 365];

/** "Kontaktlarim (-1, +3)" — Telegram'dagi kabi. */
export function privacyValue(s: PrivacySummary | undefined, t: Translator): string | undefined {
  if (!s) return undefined;
  const base =
    s.base === 'everybody' ? t('common.everybody') : s.base === 'contacts' ? t('common.myContacts') : t('common.nobody');
  const ex: string[] = [];
  if (s.restrictCount > 0) ex.push(`-${s.restrictCount}`);
  if (s.allowCount > 0) ex.push(`+${s.allowCount}`);
  return ex.length > 0 ? `${base} (${ex.join(', ')})` : base;
}

export function PrivacySettingsScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const ghost = useUIStore();
  const setPrefs = useUIStore((st) => st.setPrefs);
  const ghostSwitch = (key: keyof Prefs) => (
    <Switch
      value={ghost[key] as boolean}
      onValueChange={(v) => setPrefs({ [key]: v })}
      trackColor={{ true: c.primary, false: c.border }}
      thumbColor="#FFFFFF"
      style={{ marginLeft: 8 }}
    />
  );
  const [privacy, setPrivacy] = useState<Partial<Record<PrivacySettingKey, PrivacySummary>>>({});
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [autoDelete, setAutoDelete] = useState<number | null>(null);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);
  const [ttlDays, setTtlDays] = useState<number | null>(null);
  const [newChatsAll, setNewChatsAll] = useState<boolean | null>(null);
  const isPremium = useAuthStore((st) => st.currentUser?.isPremium ?? false);

  const premiumAlert = () => showAlert(t('settings.privacy.premiumTitle'), t('settings.privacy.premiumRequired'));

  const pickNewChats = () =>
    showActionSheet({
      title: t('settings.privacy.messagesTitle'),
      options: [
        {
          text: t('common.everybody') + (newChatsAll ? '  ✓' : ''),
          onPress: () => {
            setNewChatsAll(true);
            setNewChatsFromUnknown(true).catch((e) => {
              setNewChatsAll(newChatsAll);
              showAlert(t('common.error'), errorText(e));
            });
          },
        },
        {
          text: t('settings.privacy.contactsAndPremium') + (newChatsAll === false ? '  ✓' : '') + (isPremium ? '' : '  🔒'),
          onPress: () => {
            if (!isPremium) {
              premiumAlert();
              return;
            }
            setNewChatsAll(false);
            setNewChatsFromUnknown(false).catch((e) => {
              setNewChatsAll(newChatsAll);
              showAlert(t('common.error'), errorText(e));
            });
          },
        },
      ],
    });

  const load = useCallback(() => {
    for (const row of [...PRIVACY_ROWS, ...PRIVACY_ROWS_2]) {
      getPrivacyRules(row.key)
        .then((rules) => setPrivacy((p) => ({ ...p, [row.key]: summarizeRules(rules) })))
        .catch(() => undefined);
    }
    getNewChatsFromUnknown()
      .then(setNewChatsAll)
      .catch(() => undefined);
    getPasswordState()
      .then((s) => setHasPassword(s.has_password))
      .catch(() => undefined);
    getDefaultAutoDelete()
      .then(setAutoDelete)
      .catch(() => undefined);
    getSessions()
      .then((r) => setSessionsCount(r.sessions.length))
      .catch(() => undefined);
    getBlockedCount()
      .then(setBlockedCount)
      .catch(() => undefined);
    getAccountTtl()
      .then(setTtlDays)
      .catch(() => undefined);
  }, []);

  // Ichki ekrandan qaytganda qiymatlar yangilanadi.
  useFocusEffect(load);

  const autoDeleteLabel = (s: number) => (s === 0 ? t('common.off') : formatSeconds(s, t.p));

  const pickAutoDelete = () =>
    showActionSheet({
      title: t('settings.privacy.autoDeleteTitle'),
      options: AUTO_DELETE_OPTIONS.map((sec) => ({
        text: autoDeleteLabel(sec) + (sec === autoDelete ? '  ✓' : ''),
        onPress: () => {
          const prev = autoDelete;
          setAutoDelete(sec);
          setDefaultAutoDelete(sec).catch((e) => {
            setAutoDelete(prev);
            showAlert(t('common.error'), errorText(e));
          });
        },
      })),
    });

  const pickTtl = () =>
    showActionSheet({
      title: t('settings.privacy.ifAwayTitle'),
      options: ACCOUNT_TTL_OPTIONS.map((days) => ({
        text: formatDays(days, t.p) + (days === ttlDays ? '  ✓' : ''),
        onPress: () => {
          const prev = ttlDays;
          setTtlDays(days);
          setAccountTtl(days).catch((e) => {
            setTtlDays(prev);
            showAlert(t('common.error'), errorText(e));
          });
        },
      })),
    });

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('settings.privacy.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsCard title={t('settings.privacy.security')}>
          <SettingsRow
            icon="key"
            color="#3E9BEA"
            label={t('settings.privacy.twoStep')}
            value={hasPassword === null ? undefined : hasPassword ? t('common.on') : t('common.off')}
            onPress={() => navigation.navigate('TwoStepVerification')}
          />
          <SettingsRow
            icon="timer"
            color="#9C6ADE"
            label={t('settings.privacy.autoDelete')}
            value={autoDelete === null ? undefined : autoDeleteLabel(autoDelete)}
            onPress={autoDelete === null ? undefined : pickAutoDelete}
          />
          <SettingsRow
            icon="phone-portrait"
            color="#F59B2B"
            label={t('settings.main.devices')}
            value={sessionsCount === null ? undefined : String(sessionsCount)}
            onPress={() => navigation.navigate('Sessions')}
          />
          <SettingsRow
            icon="ban"
            color="#E5574F"
            label={t('settings.privacy.blocked')}
            value={blockedCount === null ? undefined : String(blockedCount)}
            onPress={() => navigation.navigate('BlockedUsers')}
            last
          />
        </SettingsCard>

        <SettingsCard title={t('settings.privacy.section')}>
          {PRIVACY_ROWS.map((row) => (
            <SettingsRow
              key={row.key}
              icon={row.icon}
              color={row.color}
              label={t(row.label)}
              premium={row.premium}
              value={privacyValue(privacy[row.key], t)}
              onPress={() => navigation.navigate('PrivacyRule', { setting: row.key })}
            />
          ))}
          <SettingsRow
            icon="chatbubble-ellipses"
            color="#3E9BEA"
            label={t('settings.privacy.messages')}
            premium
            value={
              newChatsAll === null ? undefined : newChatsAll ? t('common.everybody') : t('settings.privacy.contactsAndPremium')
            }
            onPress={newChatsAll === null ? undefined : pickNewChats}
          />
          {PRIVACY_ROWS_2.map((row, i) => (
            <SettingsRow
              key={row.key}
              icon={row.icon}
              color={row.color}
              label={t(row.label)}
              value={privacyValue(privacy[row.key], t)}
              onPress={() => navigation.navigate('PrivacyRule', { setting: row.key })}
              last={i === PRIVACY_ROWS_2.length - 1}
            />
          ))}
        </SettingsCard>

        <SettingsCard title={t('settings.ghost.section')} footer={t('settings.ghost.footer')}>
          <SettingsRow
            icon="eye-off"
            color="#8E99A4"
            label={t('settings.ghost.master')}
            onPress={() => setPrefs({ ghostEnabled: !ghost.ghostEnabled })}
            right={ghostSwitch('ghostEnabled')}
            last={!ghost.ghostEnabled}
          />
          {ghost.ghostEnabled &&
            GHOST_ROWS.map((row, i) => (
              <SettingsRow
                key={row.key}
                icon={row.icon}
                color={row.color}
                label={t(row.label)}
                onPress={() => setPrefs({ [row.key]: !ghost[row.key] })}
                right={ghostSwitch(row.key)}
                last={i === GHOST_ROWS.length - 1}
              />
            ))}
        </SettingsCard>

        <SettingsCard title={t('settings.privacy.deleteSection')} footer={t('settings.privacy.accountTtlFooter')}>
          <SettingsRow
            icon="trash"
            color="#8E99A4"
            label={t('settings.privacy.ifAway')}
            value={ttlDays === null ? undefined : formatDays(ttlDays, t.p)}
            onPress={ttlDays === null ? undefined : pickTtl}
            last
          />
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
