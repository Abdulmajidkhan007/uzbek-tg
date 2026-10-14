import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { authErrorText, resendCode, sendCode } from '@/services/tdlib/auth';
import { useT } from '@/i18n';

/** auth.ts'dagi codeSentVia kaliti → tarjima kaliti. */
const SENT_VIA_KEY: Record<string, string> = {
  Telegram: 'main.otp.sentTelegram',
  SMS: 'main.otp.sentSms',
  call: 'main.otp.sentCall',
  Fragment: 'main.otp.sentFragment',
};

type Props = StackScreenProps<AuthStackParamList, 'OTP'>;

const RESEND_COUNTDOWN = 30;

function OTPDigitBox({
  digit,
  isFocused,
  theme,
}: {
  digit: string;
  isFocused: boolean;
  theme: ReturnType<typeof useTheme>;
}): React.JSX.Element {
  const styles = StyleSheet.create({
    box: {
      width: 56,
      height: 64,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    digit: {
      fontSize: 28,
      fontWeight: theme.fontWeights.bold,
      color: theme.colors.text,
    },
  });

  const borderColor = isFocused
    ? theme.colors.primary
    : digit
    ? theme.colors.surfaceElevated
    : theme.colors.border;

  const backgroundColor = digit
    ? theme.colors.surfaceElevated
    : theme.colors.surface;

  return (
    <View style={[styles.box, { borderColor, backgroundColor }]}>
      <Text style={styles.digit}>{digit}</Text>
    </View>
  );
}

const MemoizedOTPDigitBox = React.memo(OTPDigitBox);

export function OTPScreen({ navigation, route }: Props): React.JSX.Element {
  const phone = route.params?.phone ?? '';
  const OTP_LENGTH = useAuthStore((s) => s.codeLength);
  const codeSentVia = useAuthStore((s) => s.codeSentVia);
  const tdState = useAuthStore((s) => s.tdState);
  const theme = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(RESEND_COUNTDOWN);
  const [isResendActive, setIsResendActive] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  const inputRefs = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasVerified = useRef<boolean>(false);

  const shakeX = useSharedValue(0);

  const boxRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  useEffect(() => {
    startCountdown();
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(RESEND_COUNTDOWN);
    setIsResendActive(false);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setIsResendActive(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2500);
  }, []);

  const triggerShake = useCallback(() => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-8, { duration: 60 }),
      withTiming(8, { duration: 60 }),
      withTiming(-4, { duration: 60 }),
      withSpring(0, { damping: 10, stiffness: 200 })
    );
  }, [shakeX]);

  const verifyOTP = useCallback(
    async (code: string) => {
      if (hasVerified.current) return;
      hasVerified.current = true;
      setIsVerifying(true);
      setErrorMessage('');

      try {
        await sendCode(code);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsVerifying(false);
        setIsSuccess(true);
        // Keyingi qadam (parol / ro'yxatdan o'tish / chatlar) TDLib holatidan
        // keladi — pastdagi useEffect yo'naltiradi.
      } catch (e) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setIsVerifying(false);
        setErrorMessage(authErrorText(e));
        triggerShake();
        setDigits(Array(OTP_LENGTH).fill(''));
        setFocusedIndex(0);
        setTimeout(() => {
          inputRefs.current[0]?.focus();
          hasVerified.current = false;
        }, 100);
      }
    },
    [OTP_LENGTH, triggerShake]
  );

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      const cleaned = value.replace(/\D/g, '');
      if (!cleaned) return;

      const char = cleaned[cleaned.length - 1] ?? '';
      const newDigits = [...digits];
      newDigits[index] = char;
      setDigits(newDigits);
      setErrorMessage('');

      if (index < OTP_LENGTH - 1) {
        const next = index + 1;
        setFocusedIndex(next);
        inputRefs.current[next]?.focus();
      } else {
        inputRefs.current[index]?.blur();
        setFocusedIndex(-1);
        const code = newDigits.join('');
        if (code.length === OTP_LENGTH) {
          verifyOTP(code);
        }
      }
    },
    [digits, verifyOTP]
  );

  const handleKeyPress = useCallback(
    (index: number, key: string) => {
      if (key === 'Backspace') {
        const newDigits = [...digits];
        if (newDigits[index]) {
          newDigits[index] = '';
          setDigits(newDigits);
        } else if (index > 0) {
          const prev = index - 1;
          newDigits[prev] = '';
          setDigits(newDigits);
          setFocusedIndex(prev);
          inputRefs.current[prev]?.focus();
        }
        setErrorMessage('');
        hasVerified.current = false;
      }
    },
    [digits]
  );

  const handleResend = useCallback(() => {
    if (!isResendActive) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDigits(Array(OTP_LENGTH).fill(''));
    setFocusedIndex(0);
    setErrorMessage('');
    hasVerified.current = false;
    startCountdown();
    resendCode().then(
      () => showToast(t('main.otp.resent')),
      (e) => showToast(authErrorText(e)),
    );
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  }, [isResendActive, startCountdown, showToast, t]);

  useEffect(() => {
    if (tdState === 'waitPassword') navigation.replace('Password');
    if (tdState === 'waitRegistration') navigation.replace('ProfileSetup', { phone });
  }, [tdState, navigation, phone]);

  // Kod uzunligi TDLib'dan kelgach maydonlar sonini moslash.
  useEffect(() => {
    setDigits(Array(OTP_LENGTH).fill(''));
  }, [OTP_LENGTH]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      fontSize: theme.fontSizes.xl,
      fontWeight: theme.fontWeights.bold,
      color: theme.colors.text,
      marginLeft: theme.spacing.sm,
    },
    content: {
      flex: 1,
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.xxxl,
      alignItems: 'center',
    },
    subtitle: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.textSecondary,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: theme.spacing.xxxl,
    },
    phoneHighlight: {
      color: theme.colors.text,
      fontWeight: theme.fontWeights.semibold,
    },
    boxRow: {
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xxxl,
    },
    hiddenInputWrapper: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1,
      overflow: 'hidden',
    },
    errorText: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.error,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    resendContainer: {
      alignItems: 'center',
      marginTop: theme.spacing.xl,
    },
    resendCountdown: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textTertiary,
    },
    resendLink: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.primary,
      fontWeight: theme.fontWeights.semibold,
    },
    resendDisabled: {
      color: theme.colors.textTertiary,
    },
    successContainer: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    successIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.success,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifyingContainer: {
      marginBottom: theme.spacing.xl,
    },
    toastContainer: {
      position: 'absolute',
      bottom: 100,
      left: theme.spacing.xxl,
      right: theme.spacing.xxl,
      backgroundColor: theme.colors.surfaceElevated,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      alignItems: 'center',
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    toastText: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.text,
      fontWeight: theme.fontWeights.medium,
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityLabel={t('common.back')}
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('main.otp.title')}</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {t(SENT_VIA_KEY[codeSentVia] ?? 'main.otp.sentSms')}
            {phone ? ': ' : ''}
            <Text style={styles.phoneHighlight}>{phone}</Text>
          </Text>

          <Animated.View style={[styles.boxRow, boxRowStyle]}>
            {digits.map((digit, index) => (
              <MemoizedOTPDigitBox
                key={index}
                digit={digit}
                isFocused={focusedIndex === index}
                theme={theme}
              />
            ))}
          </Animated.View>

          {digits.map((_, index) => (
            <View key={index} style={styles.hiddenInputWrapper}>
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                value={digits[index]}
                onChangeText={(value) => handleDigitChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                onFocus={() => setFocusedIndex(index)}
                keyboardType="number-pad"
                maxLength={2}
                caretHidden
                autoFocus={index === 0}
                accessibilityLabel={`${t('main.otp.title')} ${index + 1}/${OTP_LENGTH}`}
              />
            </View>
          ))}

          {isVerifying && (
            <View style={styles.verifyingContainer}>
              <ActivityIndicator color={theme.colors.primary} size="small" />
            </View>
          )}

          {isSuccess && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={32} color="#FFFFFF" />
              </View>
            </Animated.View>
          )}

          {errorMessage.length > 0 && (
            <Animated.Text entering={FadeIn.duration(200)} style={styles.errorText}>
              {errorMessage}
            </Animated.Text>
          )}

          <View style={styles.resendContainer}>
            {isResendActive ? (
              <TouchableOpacity
                onPress={handleResend}
                accessibilityRole="button"
              >
                <Text style={styles.resendLink}>{t('main.otp.resend')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resendCountdown}>
                {t('main.otp.resendIn', { n: countdown })}
              </Text>
            )}
          </View>
        </View>
      </View>

      {toastMessage.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
