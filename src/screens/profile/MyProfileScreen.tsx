/**
 * "Profil" tabi (Telegram'dagi kabi): katta avatar, ism, uchta tugma
 * (Rasm qo'yish / Tahrirlash / Sozlamalar) va ma'lumotlar kartasi.
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { td } from '@/services/tdlib/client';
import Avatar from '@/components/common/Avatar';
import { showAlert } from '@/components/ui/Dialog';
import { useT } from '@/i18n';
import { formatPhone } from '@/screens/settings/SettingsScreen';
import type { MainTabParamList } from '@/navigation/types';

type Props = BottomTabScreenProps<MainTabParamList, 'ProfileTab'>;

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <View style={[styles.infoRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.infoValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.infoLabel, { color: c.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function MyProfileScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.currentUser);
  const [uploading, setUploading] = useState(false);
  const name = user ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : '';

  const openSettings = (screen?: 'EditProfile') =>
    navigation.navigate('SettingsTab', screen ? { screen, initial: false } : { screen: 'SettingsMain' });

  const setPhoto = useCallback(async () => {
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9, selectionLimit: 1 });
    const uri = res.assets?.[0]?.uri;
    if (res.didCancel || !uri) return;
    setUploading(true);
    try {
      await td({
        '@type': 'setProfilePhoto',
        photo: { '@type': 'inputChatPhotoStatic', photo: { '@type': 'inputFileLocal', path: uri.replace('file://', '') } },
        is_public: false,
      });
    } catch (e) {
      showAlert(t('settings.account.photoError'), e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }, [t]);

  const buttons = [
    { icon: 'camera', label: t('settings.myprofile.setPhoto'), onPress: () => void setPhoto() },
    { icon: 'create', label: t('settings.myprofile.edit'), onPress: () => openSettings('EditProfile') },
    { icon: 'settings', label: t('settings.myprofile.settings'), onPress: () => openSettings() },
  ];

  const rows: { label: string; value: string }[] = [];
  if (user?.phone) rows.push({ label: t('settings.myprofile.mobile'), value: formatPhone(user.phone) });
  if (user?.bio) rows.push({ label: t('settings.myprofile.bio'), value: user.bio });
  if (user?.username) rows.push({ label: t('settings.myprofile.username'), value: `@${user.username}` });

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 120 }}>
        <View style={styles.head}>
          <View>
            <Avatar uri={user?.avatarUrl} name={name || '?'} size={104} />
            {uploading ? (
              <View style={styles.uploading}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.status, { color: c.primary }]}>{t('common.online')}</Text>
        </View>

        <View style={styles.buttons}>
          {buttons.map((b) => (
            <Pressable
              key={b.label}
              onPress={b.onPress}
              android_ripple={{ color: c.surfaceHighlight }}
              style={[styles.button, { backgroundColor: c.surface }]}
            >
              <Ionicons name={b.icon} size={24} color={c.primary} />
              <Text style={[styles.buttonText, { color: c.text }]} numberOfLines={1}>
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {rows.length > 0 ? (
          <View style={[styles.card, { backgroundColor: c.surface }]}>
            {rows.map((r, i) => (
              <InfoRow key={r.label} label={r.label} value={r.value} last={i === rows.length - 1} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { alignItems: 'center' },
  uploading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 52,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 24, fontWeight: '700', marginTop: 14, paddingHorizontal: 24 },
  status: { fontSize: 15, marginTop: 4 },
  buttons: { flexDirection: 'row', marginHorizontal: 12, marginTop: 22, gap: 8 },
  button: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, overflow: 'hidden' },
  buttonText: { fontSize: 13, marginTop: 6, fontWeight: '500' },
  card: { marginHorizontal: 12, marginTop: 14, borderRadius: 14, overflow: 'hidden' },
  infoRow: { paddingHorizontal: 18, paddingVertical: 11 },
  infoValue: { fontSize: 16 },
  infoLabel: { fontSize: 13.5, marginTop: 2 },
});
