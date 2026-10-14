/**
 * Sozlamalar (Telegram uslubi): markazda avatar, ism, telefon • @username,
 * pastda rangli ikonkali bo'limlar.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useChatStore } from '@/stores/chat.store';
import Avatar from '@/components/common/Avatar';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import type { SettingsStackParamList } from '@/navigation/types';
import { showAlert } from '@/components/ui/Dialog';
import { toggleThemeAnimated } from '@/components/ui/ThemeReveal';
import { LANGUAGES, useT } from '@/i18n';
import { getSessions } from '@/services/tdlib/settings';

type Props = StackScreenProps<SettingsStackParamList, 'SettingsMain'>;

export function formatPhone(phone: string | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  // O'zbekiston: +998 90 123 45 67
  if (d.startsWith('998') && d.length === 12) {
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  }
  return `+${d}`;
}

export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useUIStore((s) => s.themeMode);
  const language = useUIStore((s) => s.language);
  const folderCount = useChatStore((s) => s.folders.length);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  // Qurilmalar soni — har safar ekranga qaytganda yangilanadi.
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        getSessions()
          .then((r) => setSessionsCount(r.sessions.length))
          .catch(() => undefined);
      }),
    [navigation],
  );

  const name = user ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : '';
  const sub = [formatPhone(user?.phone), user?.username ? `@${user.username}` : '']
    .filter(Boolean)
    .join(' • ');
  const langName = LANGUAGES.find((l) => l.code === language)?.native;

  const handleLogout = useCallback(() => {
    showAlert(t('settings.main.logout'), t('settings.main.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.main.logout'), style: 'destructive', onPress: () => void logout() },
    ]);
  }, [logout, t]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={(e) => void toggleThemeAnimated(e.nativeEvent.pageX, e.nativeEvent.pageY)}
            style={styles.topBtn}
            accessibilityLabel={t('settings.main.toggleTheme')}
          >
            <Ionicons name={theme.isDark ? 'sunny-outline' : 'moon-outline'} size={23} color={c.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.topBtn}
            accessibilityLabel={t('settings.main.edit')}
          >
            <Ionicons name="create-outline" size={23} color={c.text} />
          </Pressable>
        </View>

        <View style={styles.profile}>
          <Avatar uri={user?.avatarUrl} name={name || '?'} size={96} />
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {name}
          </Text>
          {sub ? <Text style={[styles.sub, { color: c.textSecondary }]}>{sub}</Text> : null}
        </View>

        <SettingsCard>
          <SettingsRow
            icon="person"
            color="#E5574F"
            label={t('settings.main.account')}
            onPress={() => navigation.navigate('EditProfile')}
          />
          <SettingsRow
            icon="chatbubble"
            color="#3E9BEA"
            label={t('settings.main.chatSettings')}
            value={t(`settings.theme.${themeMode}`)}
            onPress={() => navigation.navigate('ChatSettings')}
          />
          <SettingsRow
            icon="lock-closed"
            color="#5DBB5A"
            label={t('settings.main.privacy')}
            onPress={() => navigation.navigate('PrivacySettings')}
          />
          <SettingsRow
            icon="notifications"
            color="#EF5350"
            label={t('settings.main.notifications')}
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <SettingsRow
            icon="pie-chart"
            color="#4CAF50"
            label={t('settings.main.dataStorage')}
            onPress={() => navigation.navigate('DataStorage')}
          />
          <SettingsRow
            icon="folder"
            color="#3E9BEA"
            label={t('settings.main.folders')}
            value={folderCount > 0 ? String(folderCount) : undefined}
            onPress={() => navigation.navigate('ChatFolders')}
          />
          <SettingsRow
            icon="phone-portrait"
            color="#F59B2B"
            label={t('settings.main.devices')}
            value={sessionsCount === null ? undefined : String(sessionsCount)}
            onPress={() => navigation.navigate('Sessions')}
          />
          <SettingsRow
            icon="globe"
            color="#9C6ADE"
            label={t('settings.main.language')}
            value={langName}
            last
            onPress={() => navigation.navigate('Language')}
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow
            icon="information-circle"
            color="#3E9BEA"
            label={t('settings.main.about')}
            last
            onPress={() => showAlert('Uzbek TG', t('settings.main.aboutText'))}
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow icon="log-out" label={t('settings.main.logout')} danger last onPress={handleLogout} />
        </SettingsCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 8 },
  topBtn: { padding: 10 },
  profile: { alignItems: 'center', paddingBottom: 6 },
  name: { fontSize: 23, fontWeight: '700', marginTop: 12, paddingHorizontal: 24 },
  sub: { fontSize: 15, marginTop: 4 },
});
