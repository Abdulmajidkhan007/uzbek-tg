/**
 * Bitta maxfiylik sozlamasi: Hamma / Kontaktlarim / Hech kim.
 * Telefon raqami uchun qo'shimcha "Raqamim orqali meni kim topa oladi?" bo'limi.
 * Istisnolar (AllowUsers/RestrictUsers/…ChatMembers) faqat sanab ko'rsatiladi
 * va saqlashda o'zgarmay qoladi.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import type { PrivacySettingKey, SettingsStackParamList } from '@/navigation/types';
import {
  errorText,
  getPrivacyRules,
  setPrivacyBase,
  summarizeRules,
  type PrivacyBase,
  type PrivacyRule,
} from '@/services/tdlib/settings';

type Props = StackScreenProps<SettingsStackParamList, 'PrivacyRule'>;

const TITLE: Record<PrivacySettingKey, string> = {
  showPhoneNumber: 'settings.privacy.phone',
  allowFindingByPhoneNumber: 'settings.privacy.findByPhone',
  showStatus: 'settings.privacy.lastSeen',
  showProfilePhoto: 'settings.privacy.photos',
  showBio: 'settings.privacy.bio',
  showBirthdate: 'settings.privacy.birthdate',
  showLinkInForwardedMessages: 'settings.privacy.forwards',
  allowCalls: 'settings.privacy.calls',
  allowPrivateVoiceAndVideoNoteMessages: 'settings.privacy.voice',
  allowChatInvites: 'settings.privacy.invites',
};

/** "Ruxsat" ma'nosidagi sozlamalar (ko'rsatish emas). */
const ALLOW_KIND = new Set<PrivacySettingKey>([
  'allowCalls',
  'allowChatInvites',
  'allowPrivateVoiceAndVideoNoteMessages',
  'allowFindingByPhoneNumber',
]);

function RadioRow({
  label,
  selected,
  onPress,
  last,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  last?: boolean;
}): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <Pressable onPress={onPress} android_ripple={{ color: c.surfaceHighlight }} style={styles.radioRow}>
      <View style={[styles.radio, { borderColor: selected ? c.primary : c.textTertiary }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: c.primary }]} /> : null}
      </View>
      <View
        style={[styles.radioBody, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
      >
        <Text style={[styles.radioLabel, { color: c.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

function useRules(key: PrivacySettingKey) {
  const t = useT();
  const [rules, setRules] = useState<PrivacyRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPrivacyRules(key)
      .then(setRules)
      .catch((e) => setError(errorText(e)));
  }, [key]);

  const choose = useCallback(
    (base: PrivacyBase) => {
      if (!rules || saving) return;
      if (summarizeRules(rules).base === base) return;
      setSaving(true);
      setPrivacyBase(key, rules, base)
        .then(setRules)
        .catch((e) => {
          const msg = errorText(e);
          showAlert(
            t('common.error'),
            /PREMIUM/i.test(msg) ? t('settings.privacy.premiumRequired') : msg,
          );
        })
        .finally(() => setSaving(false));
    },
    [key, rules, saving, t],
  );

  return { rules, error, choose };
}

function RuleSection({
  setting,
  options,
  onBase,
}: {
  setting: PrivacySettingKey;
  options: PrivacyBase[];
  /** Joriy asosiy tanlov (yuklanganda va o'zgarganda). */
  onBase?: (b: PrivacyBase) => void;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const { rules, error, choose } = useRules(setting);

  useEffect(() => {
    if (rules && onBase) onBase(summarizeRules(rules).base);
  }, [rules, onBase]);

  if (!rules) {
    return (
      <SettingsCard title={t(`settings.rule.h.${setting}`)}>
        {error ? (
          <Text style={[styles.error, { color: c.error }]}>{`${t('settings.privacy.loadError')}: ${error}`}</Text>
        ) : (
          <ActivityIndicator style={{ marginVertical: 18 }} color={c.primary} />
        )}
      </SettingsCard>
    );
  }

  const s = summarizeRules(rules);
  const label = (b: PrivacyBase) =>
    b === 'everybody' ? t('common.everybody') : b === 'contacts' ? t('common.myContacts') : t('common.nobody');
  const allow = ALLOW_KIND.has(setting);
  const count = (n: number) => (n > 0 ? t.p('settings.rule.users', n) : t('settings.rule.none'));
  const showAllow = s.base !== 'everybody';
  const showRestrict = s.base !== 'nobody';
  const hasExceptionsSection = options.length > 2 && (showAllow || showRestrict);

  return (
    <>
      <SettingsCard title={t(`settings.rule.h.${setting}`)} footer={t(`settings.rule.f.${setting}`)}>
        {options.map((b, i) => (
          <RadioRow
            key={b}
            label={label(b)}
            selected={s.base === b}
            onPress={() => choose(b)}
            last={i === options.length - 1}
          />
        ))}
      </SettingsCard>
      {hasExceptionsSection ? (
        <SettingsCard title={t('settings.rule.exceptions')} footer={t('settings.rule.exceptionsNote')}>
          {showAllow ? (
            <SettingsRow
              icon="person-add"
              color="#5DBB5A"
              label={t(allow ? 'settings.rule.alwaysAllow' : 'settings.rule.alwaysShare')}
              value={count(s.allowCount)}
              last={!showRestrict}
            />
          ) : null}
          {showRestrict ? (
            <SettingsRow
              icon="person-remove"
              color="#E5574F"
              label={t(allow ? 'settings.rule.neverAllow' : 'settings.rule.neverShare')}
              value={count(s.restrictCount)}
              last
            />
          ) : null}
        </SettingsCard>
      ) : null}
    </>
  );
}

export function PrivacyRuleScreen({ navigation, route }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const { setting } = route.params;
  const [phoneBase, setPhoneBase] = useState<PrivacyBase | null>(null);

  // Telefon raqami "Hech kim" bo'lsa — Telegram'dagi kabi "kim topa oladi" bo'limi chiqadi.
  const onPhoneBase = useCallback((b: PrivacyBase) => setPhoneBase(b), []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t(TITLE[setting])} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Ionicons name="shield-checkmark" size={56} color={c.primary} />
        </View>
        <RuleSection
          setting={setting}
          onBase={setting === 'showPhoneNumber' ? onPhoneBase : undefined}
          options={setting === 'allowFindingByPhoneNumber' ? ['everybody', 'contacts'] : ['everybody', 'contacts', 'nobody']}
        />
        {setting === 'showPhoneNumber' && phoneBase === 'nobody' ? (
          <RuleSection setting="allowFindingByPhoneNumber" options={['everybody', 'contacts']} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', paddingTop: 18, paddingBottom: 4 },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, minHeight: 50 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 20,
  },
  radioDot: { width: 11, height: 11, borderRadius: 5.5 },
  radioBody: { flex: 1, minHeight: 50, justifyContent: 'center', paddingRight: 16 },
  radioLabel: { fontSize: 16 },
  error: { margin: 16, fontSize: 14 },
});
