/**
 * "Akkaunt" ekrani (Telegram Android'dagi kabi): ism va familiya, bio
 * (qolgan belgilar hisoblagichi bilan), "Ma'lumotlaringiz" (telefon,
 * foydalanuvchi nomi, tug'ilgan kun), profil rasmi va chiqish.
 * Hamma qiymatlar TDLib'dan; saqlash: setName, setBio, setUsername,
 * setBirthdate, setProfilePhoto.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';

import * as Haptics from '@/utils/haptics';
import { useTheme } from '@/hooks/useTheme';
import { useT, type Translator } from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import Avatar from '@/components/common/Avatar';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import { formatPhone } from '@/screens/settings/SettingsScreen';
import type { SettingsStackParamList } from '@/navigation/types';
import {
  checkMyUsername,
  errorText,
  getMyBirthdate,
  getOptionValue,
  setMyBio,
  setMyBirthdate,
  setMyName,
  setMyUsername,
  setProfilePhotoFromUri,
  type Birthdate,
} from '@/services/tdlib/settings';

type Props = StackScreenProps<SettingsStackParamList, 'EditProfile'>;

const DEFAULT_BIO_MAX = 70;

export function formatBirthdate(b: Birthdate, t: Translator): string {
  const months = t('common.monthsLong').split(',');
  const m = months[b.month - 1] ?? String(b.month);
  if (t.lang === 'en') return `${m} ${b.day}${b.year ? `, ${b.year}` : ''}`;
  if (t.lang === 'ru') return `${b.day} ${m}${b.year ? ` ${b.year}` : ''}`;
  return `${b.day}-${m}${b.year ? `, ${b.year}` : ''}`;
}

export function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const user = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);

  const original = useRef({ firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', bio: user?.bio ?? '' });
  const [firstName, setFirstName] = useState(original.current.firstName);
  const [lastName, setLastName] = useState(original.current.lastName);
  const [bio, setBio] = useState(original.current.bio);
  const [bioMax, setBioMax] = useState(DEFAULT_BIO_MAX);
  const [birthdate, setBirthdate] = useState<Birthdate | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [usernameOpen, setUsernameOpen] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);

  // Bio TDLib'dan kechroq kelishi mumkin (getUserFullInfo) — tahrirlanmagan bo'lsa yangilaymiz.
  const storeBio = user?.bio ?? '';
  useEffect(() => {
    if (bio === original.current.bio && storeBio !== original.current.bio) {
      original.current.bio = storeBio;
      setBio(storeBio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeBio]);

  useEffect(() => {
    getOptionValue('bio_length_max')
      .then((v) => {
        if (typeof v === 'number' && v > 0) setBioMax(v);
      })
      .catch(() => undefined);
    if (user?.id) {
      getMyBirthdate(user.id)
        .then(setBirthdate)
        .catch(() => setBirthdate(null));
    }
  }, [user?.id]);

  const dirty =
    firstName !== original.current.firstName ||
    lastName !== original.current.lastName ||
    bio !== original.current.bio;

  const save = useCallback(async () => {
    if (!dirty || saving) return;
    if (!firstName.trim()) {
      showAlert(t('settings.account.saveError'), t('settings.account.firstNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const o = original.current;
      if (firstName !== o.firstName || lastName !== o.lastName) await setMyName(firstName.trim(), lastName.trim());
      if (bio !== o.bio) await setMyBio(bio.replace(/\n/g, ' ').trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      original.current = { firstName, lastName, bio };
      navigation.goBack();
    } catch (e) {
      showAlert(t('settings.account.saveError'), errorText(e));
    } finally {
      setSaving(false);
    }
  }, [dirty, saving, firstName, lastName, bio, navigation, t]);

  const handleBack = () => {
    if (!dirty) {
      navigation.goBack();
      return;
    }
    showAlert(t('settings.account.discardTitle'), t('settings.account.discardText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.account.discard'), style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const pickPhoto = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.9, selectionLimit: 1 });
    if (res.errorCode != null) {
      showAlert(t('settings.account.photoError'), res.errorMessage ?? res.errorCode);
      return;
    }
    const uri = res.assets?.[0]?.uri;
    if (res.didCancel || !uri) return;
    setUploading(true);
    try {
      // Yangi rasm updateUser orqali useAuthStore'ga keladi.
      await setProfilePhotoFromUri(uri);
    } catch (e) {
      showAlert(t('settings.account.photoError'), errorText(e));
    } finally {
      setUploading(false);
    }
  };

  const confirmLogout = () =>
    showAlert(t('settings.main.logout'), t('settings.main.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.main.logout'), style: 'destructive', onPress: () => void logout() },
    ]);

  const fullName = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
  const bioLeft = bioMax - bio.length;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader
        title={t('settings.account.title')}
        onBack={handleBack}
        right={
          saving ? (
            <ActivityIndicator color={c.primary} />
          ) : dirty ? (
            <Pressable onPress={() => void save()} hitSlop={10} accessibilityLabel={t('common.save')}>
              <Ionicons name="checkmark" size={26} color={c.primary} />
            </Pressable>
          ) : null
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => void pickPhoto()} style={styles.avatarWrap} accessibilityRole="button">
            <View>
              <Avatar uri={user?.avatarUrl} name={fullName || '?'} size={96} />
              <View style={styles.avatarOverlay}>
                {uploading ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="camera" size={26} color="#FFFFFF" />}
              </View>
            </View>
            <Text style={[styles.changePhoto, { color: c.primary }]}>{t('settings.account.changePhoto')}</Text>
          </Pressable>

          <SettingsCard title={t('settings.account.yourName')}>
            <View style={[styles.inputRow, { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder={t('settings.account.firstName')}
                placeholderTextColor={c.textTertiary}
                style={[styles.input, { color: c.text }]}
                maxLength={64}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder={t('settings.account.lastName')}
                placeholderTextColor={c.textTertiary}
                style={[styles.input, { color: c.text }]}
                maxLength={64}
                autoCapitalize="words"
              />
            </View>
          </SettingsCard>

          <SettingsCard title={t('settings.account.bio')} footer={t('settings.account.bioFooter')}>
            <View style={[styles.inputRow, styles.bioRow]}>
              <TextInput
                value={bio}
                onChangeText={(v) => setBio(v.replace(/\n/g, ' ').slice(0, bioMax))}
                placeholder={t('settings.account.bioPlaceholder')}
                placeholderTextColor={c.textTertiary}
                style={[styles.input, { color: c.text, flex: 1 }]}
                multiline
                maxLength={bioMax}
              />
              <Text style={[styles.counter, { color: bioLeft <= 10 ? c.error : c.textTertiary }]}>{bioLeft}</Text>
            </View>
          </SettingsCard>

          <SettingsCard title={t('settings.account.yourInfo')}>
            <SettingsRow
              icon="call"
              color="#5DBB5A"
              label={t('settings.account.phone')}
              value={formatPhone(user?.phone)}
              onPress={() => showAlert(t('settings.account.phone'), t('settings.account.phoneChangeNA'))}
            />
            <SettingsRow
              icon="at"
              color="#3E9BEA"
              label={t('settings.account.username')}
              value={user?.username ? `@${user.username}` : t('settings.account.none')}
              onPress={() => setUsernameOpen(true)}
            />
            <SettingsRow
              icon="gift"
              color="#E05C9C"
              label={t('settings.account.birthday')}
              value={birthdate === undefined ? undefined : birthdate ? formatBirthdate(birthdate, t) : t('settings.account.add')}
              onPress={birthdate === undefined ? undefined : () => setBirthdayOpen(true)}
              last
            />
          </SettingsCard>

          <SettingsCard>
            <SettingsRow icon="log-out" label={t('settings.main.logout')} danger last onPress={confirmLogout} />
          </SettingsCard>
        </ScrollView>
      </KeyboardAvoidingView>

      {usernameOpen && user ? (
        <UsernameModal userId={user.id} initial={user.username ?? ''} onClose={() => setUsernameOpen(false)} />
      ) : null}
      {birthdayOpen ? (
        <BirthdayModal
          initial={birthdate ?? null}
          onClose={() => setBirthdayOpen(false)}
          onSaved={(b) => {
            setBirthdate(b);
            setBirthdayOpen(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Pastdan chiqadigan oyna (modal) asosi
// ---------------------------------------------------------------------------

function Sheet({
  title,
  children,
  onClose,
  onSave,
  saving,
  canSave,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.modalRoot} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <Text style={[styles.sheetTitle, { color: c.text }]}>{title}</Text>
          {children}
          <View style={styles.sheetButtons}>
            <Pressable onPress={onClose} style={styles.sheetBtn} hitSlop={6}>
              <Text style={[styles.sheetBtnText, { color: c.primary }]}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable onPress={onSave} disabled={!canSave || saving} style={styles.sheetBtn} hitSlop={6}>
              {saving ? (
                <ActivityIndicator color={c.primary} />
              ) : (
                <Text style={[styles.sheetBtnText, { color: canSave ? c.primary : c.textTertiary }]}>
                  {t('common.save')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Foydalanuvchi nomi
// ---------------------------------------------------------------------------

type UsernameStatus = { kind: 'idle' | 'checking' | 'ok' | 'error'; text?: string };

function UsernameModal({
  userId,
  initial,
  onClose,
}: {
  userId: string;
  initial: string;
  onClose: () => void;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<UsernameStatus>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const v = value.trim();
    const my = ++seq.current;
    if (v === initial || v === '') {
      setStatus({ kind: 'idle' });
      return;
    }
    if (/^[0-9_]/.test(v)) {
      setStatus({ kind: 'error', text: t('settings.account.usernameStart') });
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(v)) {
      setStatus({ kind: 'error', text: t('settings.account.usernameInvalid') });
      return;
    }
    if (v.length < 5) {
      setStatus({ kind: 'error', text: t('settings.account.usernameShort') });
      return;
    }
    setStatus({ kind: 'checking', text: t('settings.account.usernameChecking') });
    const timer = setTimeout(() => {
      checkMyUsername(userId, v)
        .then((r) => {
          if (my !== seq.current) return;
          const map: Record<string, string> = {
            invalid: 'settings.account.usernameInvalid',
            occupied: 'settings.account.usernameOccupied',
            purchasable: 'settings.account.usernamePurchasable',
            tooMany: 'settings.account.usernameTooMany',
            other: 'settings.account.usernameInvalid',
          };
          setStatus(
            r === 'ok'
              ? { kind: 'ok', text: t('settings.account.usernameAvailable', { u: v }) }
              : { kind: 'error', text: t(map[r] ?? 'settings.account.usernameInvalid') },
          );
        })
        .catch((e) => {
          if (my === seq.current) setStatus({ kind: 'error', text: errorText(e) });
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [value, initial, userId, t]);

  const v = value.trim();
  const canSave = v !== initial && (v === '' || status.kind === 'ok');

  const save = () => {
    setSaving(true);
    setMyUsername(v)
      .then(onClose)
      .catch((e) => setStatus({ kind: 'error', text: errorText(e) }))
      .finally(() => setSaving(false));
  };

  const statusColor = status.kind === 'ok' ? c.success : status.kind === 'error' ? c.error : c.textSecondary;

  return (
    <Sheet title={t('settings.account.username')} onClose={onClose} onSave={save} saving={saving} canSave={canSave}>
      <View style={[styles.sheetInput, { borderBottomColor: c.primary }]}>
        <Text style={[styles.at, { color: c.textSecondary }]}>@</Text>
        <TextInput
          value={value}
          onChangeText={(x) => setValue(x.replace(/^@+/, '').replace(/\s/g, ''))}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={32}
          style={[styles.input, { color: c.text, flex: 1 }]}
        />
      </View>
      {status.text ? <Text style={[styles.status, { color: statusColor }]}>{status.text}</Text> : null}
      <Text style={[styles.sheetFooter, { color: c.textSecondary }]}>{t('settings.account.usernameFooter')}</Text>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Tug'ilgan kun
// ---------------------------------------------------------------------------

function BirthdayModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Birthdate | null;
  onClose: () => void;
  onSaved: (b: Birthdate | null) => void;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const [day, setDay] = useState(initial ? String(initial.day) : '');
  const [month, setMonth] = useState(initial ? String(initial.month) : '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parse = (): Birthdate | null => {
    const d = Number(day);
    const m = Number(month);
    const y = year.trim() ? Number(year) : 0;
    const thisYear = new Date().getFullYear();
    if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return null;
    if (m < 1 || m > 12 || d < 1) return null;
    if (y !== 0 && (y < 1900 || y > thisYear)) return null;
    // Kabisa yili noma'lum bo'lsa 29-fevralga ruxsat beriladi.
    const daysInMonth = new Date(y || 2000, m, 0).getDate();
    if (d > daysInMonth) return null;
    return { day: d, month: m, year: y };
  };

  const apply = (b: Birthdate | null) => {
    setSaving(true);
    setMyBirthdate(b)
      .then(() => onSaved(b))
      .catch((e) => setError(errorText(e)))
      .finally(() => setSaving(false));
  };

  const save = () => {
    const b = parse();
    if (!b) {
      setError(t('settings.account.invalidDate'));
      return;
    }
    apply(b);
  };

  const box = (value: string, set: (v: string) => void, label: string, max: number, flex: number) => (
    <View style={{ flex }}>
      <Text style={[styles.dateLabel, { color: c.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          setError(null);
          set(v.replace(/\D/g, '').slice(0, max));
        }}
        keyboardType="number-pad"
        maxLength={max}
        style={[styles.dateInput, { color: c.text, borderBottomColor: c.primary }]}
      />
    </View>
  );

  return (
    <Sheet
      title={t('settings.account.birthday')}
      onClose={onClose}
      onSave={save}
      saving={saving}
      canSave={day !== '' && month !== ''}
    >
      <View style={styles.dateRow}>
        {box(day, setDay, t('settings.account.day'), 2, 1)}
        {box(month, setMonth, t('settings.account.month'), 2, 1)}
        {box(year, setYear, t('settings.account.year'), 4, 1.6)}
      </View>
      {error ? <Text style={[styles.status, { color: c.error }]}>{error}</Text> : null}
      <Text style={[styles.sheetFooter, { color: c.textSecondary }]}>{t('settings.account.birthdayFooter')}</Text>
      {initial ? (
        <Pressable onPress={() => apply(null)} disabled={saving} style={styles.removeBtn}>
          <Text style={[styles.sheetBtnText, { color: c.error }]}>{t('settings.account.removeBirthday')}</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatarWrap: { alignItems: 'center', paddingTop: 18, paddingBottom: 4 },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { fontSize: 15, fontWeight: '600', marginTop: 10 },
  inputRow: { paddingHorizontal: 16, minHeight: 50, justifyContent: 'center' },
  bioRow: { flexDirection: 'row', alignItems: 'center' },
  input: { fontSize: 16, paddingVertical: 10 },
  counter: { fontSize: 14, marginLeft: 8 },
  modalRoot: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 24 },
  sheet: { borderRadius: 16, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 10 },
  sheetTitle: { fontSize: 19, fontWeight: '700', marginBottom: 12 },
  sheetInput: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2 },
  at: { fontSize: 16, marginRight: 2 },
  status: { fontSize: 13.5, marginTop: 8 },
  sheetFooter: { fontSize: 13, lineHeight: 18, marginTop: 12 },
  sheetButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  sheetBtn: { paddingHorizontal: 12, paddingVertical: 10, minWidth: 64, alignItems: 'center' },
  sheetBtnText: { fontSize: 15.5, fontWeight: '600' },
  dateRow: { flexDirection: 'row', gap: 14 },
  dateLabel: { fontSize: 13 },
  dateInput: { fontSize: 18, borderBottomWidth: 2, paddingVertical: 6 },
  removeBtn: { alignSelf: 'flex-start', paddingVertical: 10, marginTop: 6 },
});
