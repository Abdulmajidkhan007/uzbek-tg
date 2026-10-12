import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { authErrorText, sendPassword } from '@/services/tdlib/auth';
import * as Haptics from '@/utils/haptics';

type Props = StackScreenProps<AuthStackParamList, 'Password'>;

/** Ikki bosqichli tekshiruv (2FA) paroli — authorizationStateWaitPassword. */
export function PasswordScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hint = useAuthStore((s) => s.passwordHint);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canSubmit = password.length > 0 && !isLoading;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError('');
    try {
      await sendPassword(password);
      // Muvaffaqiyatda TDLib "ready" holatiga o'tadi va RootNavigator chatlarga o'tkazadi.
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(authErrorText(e));
      setIsLoading(false);
    }
  }, [canSubmit, password]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top },
    header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
    content: { flex: 1, paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl },
    title: { color: theme.colors.text, fontSize: 26, fontWeight: '700', marginBottom: theme.spacing.sm },
    subtitle: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: theme.spacing.xl },
    input: {
      backgroundColor: theme.colors.inputBackground,
      color: theme.colors.text,
      borderRadius: 12,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: 14,
      fontSize: 17,
      borderWidth: 1,
      borderColor: error ? theme.colors.error : theme.colors.border,
    },
    error: { color: theme.colors.error, marginTop: theme.spacing.sm, fontSize: 14 },
    button: {
      marginTop: theme.spacing.xl,
      backgroundColor: canSubmit ? theme.colors.primary : theme.colors.surfaceHighlight,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Orqaga">
          <Ionicons name="chevron-back" size={28} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Parol</Text>
        <Text style={styles.subtitle}>
          Akkauntingizda ikki bosqichli tekshiruv yoqilgan. Telegram parolingizni kiriting.
          {hint ? `\nEslatma: ${hint}` : ''}
        </Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError('');
          }}
          placeholder="Parol"
          placeholderTextColor={theme.colors.textTertiary}
          secureTextEntry
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={!canSubmit}>
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Davom etish</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
