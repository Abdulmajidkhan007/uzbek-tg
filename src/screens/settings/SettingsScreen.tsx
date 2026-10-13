/**
 * Sozlamalar (Telegram uslubi): markazda avatar, ism, telefon • @username,
 * pastda rangli ikonkali bo'limlar.
 */
import React, { useCallback } from 'react';
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

const THEME_LABEL: Record<string, string> = { dark: "Qorong'i", light: "Yorug'", system: 'Tizim' };

export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useUIStore((s) => s.themeMode);
  const folderCount = useChatStore((s) => s.folders.length);

  const name = user ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : '';
  const sub = [formatPhone(user?.phone), user?.username ? `@${user.username}` : '']
    .filter(Boolean)
    .join(' • ');

  const handleLogout = useCallback(() => {
    showAlert('Chiqish', 'Akkauntdan chiqmoqchimisiz? Qayta kirish uchun Telegram kodi kerak bo\'ladi.', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Chiqish', style: 'destructive', onPress: () => void logout() },
    ]);
  }, [logout]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.topBtn}
            accessibilityLabel="Tahrirlash"
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
          <SettingsRow icon="person" color="#E5574F" label="Akkaunt" onPress={() => navigation.navigate('EditProfile')} />
          <SettingsRow
            icon="chatbubble"
            color="#3E9BEA"
            label="Chat sozlamalari"
            value={THEME_LABEL[themeMode]}
            onPress={() => navigation.navigate('ThemeSettings')}
          />
          <SettingsRow
            icon="lock-closed"
            color="#5DBB5A"
            label="Maxfiylik va xavfsizlik"
            onPress={() => navigation.navigate('PrivacySettings')}
          />
          <SettingsRow
            icon="notifications"
            color="#EF5350"
            label="Bildirishnomalar"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
          <SettingsRow
            icon="pie-chart"
            color="#4CAF50"
            label="Ma'lumotlar va xotira"
            onPress={() => navigation.navigate('Storage')}
          />
          <SettingsRow
            icon="folder"
            color="#3E9BEA"
            label="Chat papkalari"
            value={folderCount > 0 ? String(folderCount) : undefined}
            onPress={() => navigation.navigate('ChatFolders')}
          />
          <SettingsRow
            icon="phone-portrait"
            color="#F59B2B"
            label="Qurilmalar"
            onPress={() => navigation.navigate('Sessions')}
          />
          <SettingsRow
            icon="globe"
            color="#9C6ADE"
            label="Til"
            value="O'zbekcha"
            last
            onPress={() => showAlert('Til', "Hozircha ilova faqat o'zbek tilida.")}
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow
            icon="ban"
            color="#8E99A4"
            label="Bloklanganlar"
            onPress={() => navigation.navigate('BlockedUsers')}
          />
          <SettingsRow
            icon="information-circle"
            color="#3E9BEA"
            label="Uzbek TG haqida"
            last
            onPress={() =>
              showAlert(
                'Uzbek TG',
                "Telegram uchun norasmiy mijoz. Rasmiy TDLib kutubxonasi asosida ishlaydi, akkauntingiz Telegram serverlarida qoladi.",
              )
            }
          />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow icon="log-out" label="Chiqish" danger last onPress={handleLogout} />
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
