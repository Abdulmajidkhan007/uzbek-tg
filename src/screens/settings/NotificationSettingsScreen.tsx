/**
 * Bildirishnomalar va tovushlar (Telegram Android'dagi kabi).
 * Doira sozlamalari — TDLib (get/setScopeNotificationSettings), ilova ichidagi
 * va telefon sozlamalari — useUIStore (qurilmada saqlanadi).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, ScrollView, StyleSheet, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useUIStore } from '@/stores/ui.store';
import { AppNative } from '@/services/native';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showActionSheet, showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';
import {
  errorText,
  getOptionValue,
  getScopeSettings,
  MUTE_FOREVER,
  resetAllNotificationSettings,
  setBooleanOption,
  setScopeSettings,
  type NotifScope,
  type ScopeSettings,
} from '@/services/tdlib/settings';

type Props = StackScreenProps<SettingsStackParamList, 'NotificationSettings'>;

const SCOPES: { scope: NotifScope; label: string; icon: string; color: string }[] = [
  { scope: 'private', label: 'settings.notif.private', icon: 'person', color: '#3E9BEA' },
  { scope: 'group', label: 'settings.notif.groups', icon: 'people', color: '#5DBB5A' },
  { scope: 'channel', label: 'settings.notif.channels', icon: 'megaphone', color: '#F59B2B' },
];

export function NotificationSettingsScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const inAppSounds = useUIStore((s) => s.inAppSounds);
  const inAppVibrate = useUIStore((s) => s.inAppVibrate);
  const inAppPreview = useUIStore((s) => s.inAppPreview);
  const notificationsEnabled = useUIStore((s) => s.notificationsEnabled);
  const setPrefs = useUIStore((s) => s.setPrefs);

  const [scopes, setScopes] = useState<Partial<Record<NotifScope, ScopeSettings>>>({});
  /** Option qiymati teskari: disable_contact_registered_notifications. */
  const [contactJoined, setContactJoined] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<boolean | null>(null);

  const loadScopes = useCallback(() => {
    for (const s of SCOPES) {
      getScopeSettings(s.scope)
        .then((v) => setScopes((p) => ({ ...p, [s.scope]: v })))
        .catch(() => undefined);
    }
  }, []);

  const checkPermission = useCallback(() => {
    AppNative?.hasNotificationPermission?.()
      .then(setPermission)
      .catch(() => setPermission(null));
  }, []);

  useEffect(() => {
    loadScopes();
    getOptionValue('disable_contact_registered_notifications')
      .then((v) => setContactJoined(v !== true))
      .catch(() => undefined);
    checkPermission();
    // Telefon sozlamalaridan qaytganda ruxsat holatini qayta tekshiramiz.
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') checkPermission();
    });
    return () => sub.remove();
  }, [loadScopes, checkPermission]);

  const updateScope = (scope: NotifScope, patch: Partial<ScopeSettings>) => {
    const prev = scopes[scope];
    if (!prev) return;
    const next = { ...prev, ...patch };
    setScopes((p) => ({ ...p, [scope]: next }));
    setScopeSettings(scope, next).catch((e) => {
      setScopes((p) => ({ ...p, [scope]: prev }));
      showAlert(t('common.error'), errorText(e));
    });
  };

  const scopeSubtitle = (s: ScopeSettings | undefined): string | undefined => {
    if (!s) return undefined;
    const base = s.mute_for > 0 ? t('common.off') : t('common.on');
    return s.mute_for === 0 && !s.show_preview ? `${base}, ${t('settings.notif.noPreview')}` : base;
  };

  const openScopeSheet = (scope: NotifScope, label: string) => {
    const s = scopes[scope];
    if (!s) return;
    showActionSheet({
      title: label,
      options: [
        {
          text: s.mute_for > 0 ? t('settings.notif.enable') : t('settings.notif.disable'),
          icon: s.mute_for > 0 ? 'notifications' : 'notifications-off',
          onPress: () => updateScope(scope, { mute_for: s.mute_for > 0 ? 0 : MUTE_FOREVER }),
        },
        {
          text: s.show_preview ? t('settings.notif.previewOff') : t('settings.notif.previewOn'),
          icon: s.show_preview ? 'eye-off' : 'eye',
          onPress: () => updateScope(scope, { show_preview: !s.show_preview }),
        },
      ],
    });
  };

  const toggleContactJoined = (v: boolean) => {
    setContactJoined(v);
    setBooleanOption('disable_contact_registered_notifications', !v).catch((e) => {
      setContactJoined(!v);
      showAlert(t('common.error'), errorText(e));
    });
  };

  const requestPermission = () => {
    AppNative?.requestNotificationPermission?.()
      .then((ok) => {
        setPermission(ok);
        if (!ok) showAlert(t('settings.notif.permissionMissing'), t('settings.notif.permissionDenied'));
      })
      .catch((e) => showAlert(t('common.error'), errorText(e)));
  };

  const confirmReset = () =>
    showAlert(t('settings.notif.reset'), t('settings.notif.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.notif.reset'),
        style: 'destructive',
        onPress: () =>
          resetAllNotificationSettings()
            .then(() => {
              loadScopes();
              showAlert(t('settings.notif.resetDone'));
            })
            .catch((e) => showAlert(t('common.error'), errorText(e))),
      },
    ]);

  const sw = (value: boolean, onChange?: (v: boolean) => void) => (
    <Switch
      value={value}
      onValueChange={onChange}
      disabled={!onChange}
      trackColor={{ true: c.primary, false: c.surfaceHighlight }}
      thumbColor="#FFFFFF"
    />
  );

  const group = scopes.group;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('settings.notif.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsCard title={t('settings.notif.chatsSection')}>
          {SCOPES.map((row, i) => {
            const s = scopes[row.scope];
            return (
              <SettingsRow
                key={row.scope}
                icon={row.icon}
                color={row.color}
                label={t(row.label)}
                subtitle={scopeSubtitle(s)}
                onPress={s ? () => openScopeSheet(row.scope, t(row.label)) : undefined}
                right={
                  s
                    ? sw(s.mute_for === 0, (v) => updateScope(row.scope, { mute_for: v ? 0 : MUTE_FOREVER }))
                    : undefined
                }
                last={i === SCOPES.length - 1}
              />
            );
          })}
        </SettingsCard>

        <SettingsCard title={t('settings.notif.events')}>
          <SettingsRow
            icon="person-add"
            color="#5DBB5A"
            label={t('settings.notif.contactJoined')}
            right={contactJoined === null ? undefined : sw(contactJoined, toggleContactJoined)}
            onPress={contactJoined === null ? undefined : () => toggleContactJoined(!contactJoined)}
          />
          <SettingsRow
            icon="pin"
            color="#3E9BEA"
            label={t('settings.notif.pinned')}
            subtitle={t('settings.notif.pinnedSub')}
            right={
              group
                ? sw(!group.disable_pinned_message_notifications, (v) =>
                    updateScope('group', { disable_pinned_message_notifications: !v }),
                  )
                : undefined
            }
            onPress={
              group
                ? () =>
                    updateScope('group', {
                      disable_pinned_message_notifications: !group.disable_pinned_message_notifications,
                    })
                : undefined
            }
            last
          />
        </SettingsCard>

        <SettingsCard title={t('settings.notif.inApp')}>
          <SettingsRow
            icon="volume-high"
            color="#E5574F"
            label={t('settings.notif.inAppSounds')}
            right={sw(inAppSounds, (v) => setPrefs({ inAppSounds: v }))}
            onPress={() => setPrefs({ inAppSounds: !inAppSounds })}
          />
          <SettingsRow
            icon="phone-portrait"
            color="#9C6ADE"
            label={t('settings.notif.inAppVibrate')}
            right={sw(inAppVibrate, (v) => setPrefs({ inAppVibrate: v }))}
            onPress={() => setPrefs({ inAppVibrate: !inAppVibrate })}
          />
          <SettingsRow
            icon="chatbox-ellipses"
            color="#3E9BEA"
            label={t('settings.notif.inAppPreview')}
            right={sw(inAppPreview, (v) => setPrefs({ inAppPreview: v }))}
            onPress={() => setPrefs({ inAppPreview: !inAppPreview })}
            last
          />
        </SettingsCard>

        <SettingsCard title={t('settings.notif.phone')} footer={t('settings.notif.phoneFooter')}>
          <SettingsRow
            icon="notifications"
            color="#EF5350"
            label={t('settings.notif.phoneEnabled')}
            right={sw(notificationsEnabled, (v) => setPrefs({ notificationsEnabled: v }))}
            onPress={() => setPrefs({ notificationsEnabled: !notificationsEnabled })}
            last={permission !== false}
          />
          {permission === false ? (
            <SettingsRow
              icon="alert-circle"
              color="#F59B2B"
              label={t('settings.notif.permissionMissing')}
              subtitle={t('settings.notif.permissionMissingSub')}
              onPress={requestPermission}
              last
            />
          ) : null}
        </SettingsCard>

        <SettingsCard footer={t('settings.notif.resetFooter')}>
          <SettingsRow icon="refresh" label={t('settings.notif.reset')} danger onPress={confirmReset} last />
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
