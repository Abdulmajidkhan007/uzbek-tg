/**
 * Ikki bosqichli tekshiruv (bulutli parol): getPasswordState, setPassword,
 * setRecoveryEmailAddress, checkRecoveryEmailAddressCode,
 * resendRecoveryEmailAddressCode, cancelPasswordReset.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useT, type Translator } from '@/i18n';
import { SettingsCard, SettingsRow } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { showAlert } from '@/components/ui/Dialog';
import type { SettingsStackParamList } from '@/navigation/types';
import {
  cancelPasswordReset,
  checkRecoveryEmailCode,
  errorText,
  getPasswordState,
  resendRecoveryEmailCode,
  setPassword,
  setRecoveryEmail,
  type PasswordState,
} from '@/services/tdlib/settings';

type Props = StackScreenProps<SettingsStackParamList, 'TwoStepVerification'>;
type Mode = 'view' | 'create' | 'change' | 'off' | 'email';

/** TDLib xato kodlarini tushunarli matnga aylantiradi. */
function passwordError(e: unknown, t: Translator): string {
  const m = errorText(e);
  if (m.includes('PASSWORD_HASH_INVALID')) return t('settings.twostep.wrongPassword');
  if (m.includes('EMAIL_INVALID')) return t('settings.twostep.emailInvalid');
  if (m.includes('CODE_INVALID')) return t('settings.twostep.codeInvalid');
  if (m.includes('CODE_EXPIRED') || m.includes('EMAIL_HASH_EXPIRED')) return t('settings.twostep.codeExpired');
  if (m.includes('PASSWORD_TOO_FRESH') || m.includes('SESSION_TOO_FRESH')) return t('settings.twostep.tooFresh');
  if (/FLOOD|Too Many Requests/i.test(m)) return t('settings.twostep.flood');
  return m;
}

function Field({
  value,
  onChange,
  placeholder,
  secure,
  keyboard,
  last,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboard?: 'email-address' | 'number-pad';
  last?: boolean;
  autoFocus?: boolean;
}): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <View style={[styles.field, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        secureTextEntry={secure}
        keyboardType={keyboard}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        style={[styles.input, { color: c.text }]}
      />
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  busy,
  danger,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  danger?: boolean;
}): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.button, { backgroundColor: danger ? c.error : c.primary, opacity: busy ? 0.7 : 1 }]}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

export function TwoStepScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const [ps, setPs] = useState<PasswordState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState('');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [hint, setHint] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    getPasswordState()
      .then((s) => {
        setPs(s);
        setLoadError(null);
      })
      .catch((e) => setLoadError(errorText(e)));
  }, []);

  useEffect(load, [load]);

  const reset = (m: Mode) => {
    setCurrent('');
    setPass1('');
    setPass2('');
    setHint('');
    setEmail('');
    setCode('');
    setFormError(null);
    setMode(m);
  };

  /** TDLib so'rovini bajaradi, natijadagi yangi holatni qo'llaydi. */
  const run = async (fn: () => Promise<PasswordState>, doneKey?: string) => {
    setBusy(true);
    setFormError(null);
    try {
      const next = await fn();
      setPs(next);
      reset('view');
      if (doneKey && !next.recovery_email_address_code_info) showAlert(t(doneKey));
    } catch (e) {
      setFormError(passwordError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const validateNew = (): boolean => {
    if (!pass1) {
      setFormError(t('settings.twostep.empty'));
      return false;
    }
    if (pass1 !== pass2) {
      setFormError(t('settings.twostep.mismatch'));
      return false;
    }
    if (hint && hint === pass1) {
      setFormError(t('settings.twostep.hintSame'));
      return false;
    }
    return true;
  };

  const submitCreate = () => {
    if (!validateNew()) return;
    void run(
      () => setPassword({ oldPassword: '', newPassword: pass1, hint: hint.trim(), email: email.trim() || undefined }),
      'settings.twostep.doneSet',
    );
  };

  const submitChange = () => {
    if (!current) {
      setFormError(t('settings.twostep.empty'));
      return;
    }
    if (!validateNew()) return;
    void run(() => setPassword({ oldPassword: current, newPassword: pass1, hint: hint.trim() }), 'settings.twostep.doneChanged');
  };

  const submitOff = () => {
    if (!current) {
      setFormError(t('settings.twostep.empty'));
      return;
    }
    showAlert(t('settings.twostep.turnOff'), t('settings.twostep.turnOffConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.twostep.turnOff'),
        style: 'destructive',
        onPress: () => void run(() => setPassword({ oldPassword: current, newPassword: '' }), 'settings.twostep.doneOff'),
      },
    ]);
  };

  const submitEmail = () => {
    if (!current) {
      setFormError(t('settings.twostep.empty'));
      return;
    }
    if (!email.includes('@')) {
      setFormError(t('settings.twostep.emailInvalid'));
      return;
    }
    void run(() => setRecoveryEmail(current, email.trim()), 'settings.twostep.emailConfirmed');
  };

  const submitCode = () => {
    if (!code.trim()) return;
    void run(() => checkRecoveryEmailCode(code.trim()), 'settings.twostep.emailConfirmed');
  };

  const resend = () => {
    setBusy(true);
    resendRecoveryEmailCode()
      .then((s) => {
        setPs(s);
        showAlert(t('settings.twostep.resent'));
      })
      .catch((e) => showAlert(t('common.error'), passwordError(e, t)))
      .finally(() => setBusy(false));
  };

  const cancelReset = () =>
    cancelPasswordReset()
      .then(load)
      .catch((e) => showAlert(t('common.error'), passwordError(e, t)));

  const onBack = () => (mode === 'view' ? navigation.goBack() : reset('view'));

  const errorLine = formError ? <Text style={[styles.formError, { color: c.error }]}>{formError}</Text> : null;

  const renderBody = (): React.ReactNode => {
    if (!ps) {
      return loadError ? (
        <Text style={[styles.formError, { color: c.error }]}>{`${t('settings.privacy.loadError')}: ${loadError}`}</Text>
      ) : (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.primary} />
      );
    }

    const codeInfo = ps.recovery_email_address_code_info;
    if (codeInfo && mode === 'view') {
      return (
        <>
          <Hero icon="mail" title={t('settings.twostep.codeTitle')} text={t('settings.twostep.codeText', { email: codeInfo.email_address_pattern })} />
          <SettingsCard>
            <Field value={code} onChange={setCode} placeholder={t('settings.twostep.code')} keyboard="number-pad" last autoFocus />
          </SettingsCard>
          {errorLine}
          <PrimaryButton label={t('settings.twostep.confirm')} onPress={submitCode} busy={busy} />
          <Pressable onPress={resend} disabled={busy} style={styles.linkBtn}>
            <Text style={[styles.link, { color: c.primary }]}>{t('settings.twostep.resend')}</Text>
          </Pressable>
        </>
      );
    }

    if (mode === 'create' || mode === 'change') {
      return (
        <>
          <SettingsCard footer={t('settings.twostep.hintFooter')}>
            {mode === 'change' ? (
              <Field value={current} onChange={setCurrent} placeholder={t('settings.twostep.currentPassword')} secure autoFocus />
            ) : null}
            <Field
              value={pass1}
              onChange={setPass1}
              placeholder={t('settings.twostep.newPassword')}
              secure
              autoFocus={mode === 'create'}
            />
            <Field value={pass2} onChange={setPass2} placeholder={t('settings.twostep.repeatPassword')} secure />
            <Field value={hint} onChange={setHint} placeholder={t('settings.twostep.hint')} last />
          </SettingsCard>
          {mode === 'create' ? (
            <SettingsCard footer={t('settings.twostep.emailFooter')}>
              <Field value={email} onChange={setEmail} placeholder={t('settings.twostep.email')} keyboard="email-address" last />
            </SettingsCard>
          ) : null}
          {errorLine}
          <PrimaryButton
            label={t(mode === 'create' ? 'settings.twostep.setPassword' : 'settings.twostep.changePassword')}
            onPress={mode === 'create' ? submitCreate : submitChange}
            busy={busy}
          />
        </>
      );
    }

    if (mode === 'off') {
      return (
        <>
          <SettingsCard>
            <Field value={current} onChange={setCurrent} placeholder={t('settings.twostep.currentPassword')} secure last autoFocus />
          </SettingsCard>
          {errorLine}
          <PrimaryButton label={t('settings.twostep.turnOff')} onPress={submitOff} busy={busy} danger />
        </>
      );
    }

    if (mode === 'email') {
      return (
        <>
          <SettingsCard footer={t('settings.twostep.emailFooter')}>
            <Field value={current} onChange={setCurrent} placeholder={t('settings.twostep.currentPassword')} secure autoFocus />
            <Field value={email} onChange={setEmail} placeholder={t('settings.twostep.emailPlain')} keyboard="email-address" last />
          </SettingsCard>
          {errorLine}
          <PrimaryButton label={t('common.save')} onPress={submitEmail} busy={busy} />
        </>
      );
    }

    if (!ps.has_password) {
      return (
        <>
          <Hero icon="key" title={t('settings.twostep.title')} text={t('settings.twostep.intro')} />
          <PrimaryButton label={t('settings.twostep.setPassword')} onPress={() => reset('create')} />
        </>
      );
    }

    return (
      <>
        <Hero icon="shield-checkmark" title={t('settings.twostep.onTitle')} text={t('settings.twostep.onText')} />
        {ps.pending_reset_date > 0 ? (
          <SettingsCard footer={t('settings.twostep.pendingReset', { date: format(new Date(ps.pending_reset_date * 1000), 'dd.MM.yyyy HH:mm') })}>
            <SettingsRow icon="close-circle" color="#F59B2B" label={t('settings.twostep.cancelReset')} onPress={cancelReset} last />
          </SettingsCard>
        ) : null}
        <SettingsCard>
          <SettingsRow icon="key" color="#3E9BEA" label={t('settings.twostep.changePassword')} onPress={() => reset('change')} />
          {ps.password_hint ? (
            <SettingsRow icon="bulb" color="#F59B2B" label={t('settings.twostep.hintRow')} value={ps.password_hint} />
          ) : null}
          <SettingsRow
            icon="mail"
            color="#5DBB5A"
            label={t(ps.has_recovery_email_address ? 'settings.twostep.changeEmail' : 'settings.twostep.setEmail')}
            value={t(ps.has_recovery_email_address ? 'settings.twostep.emailSet' : 'settings.twostep.emailNotSet')}
            onPress={() => reset('email')}
          />
          <SettingsRow icon="lock-open" label={t('settings.twostep.turnOff')} danger onPress={() => reset('off')} last />
        </SettingsCard>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('settings.twostep.title')} onBack={onBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {renderBody()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Hero({ icon, title, text }: { icon: string; title: string; text: string }): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <View style={styles.hero}>
      <View style={[styles.heroIcon, { backgroundColor: c.primary }]}>
        <Ionicons name={icon} size={44} color="#FFFFFF" />
      </View>
      <Text style={[styles.heroTitle, { color: c.text }]}>{title}</Text>
      <Text style={[styles.heroText, { color: c.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 28, paddingBottom: 8 },
  heroIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 20, fontWeight: '700', marginTop: 18, textAlign: 'center' },
  heroText: { fontSize: 15, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  field: { paddingHorizontal: 16, minHeight: 52, justifyContent: 'center' },
  input: { fontSize: 16, paddingVertical: 10 },
  formError: { marginHorizontal: 28, marginTop: 12, fontSize: 14 },
  button: {
    marginHorizontal: 16,
    marginTop: 22,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  linkBtn: { alignSelf: 'center', marginTop: 16, padding: 8 },
  link: { fontSize: 15, fontWeight: '500' },
});
