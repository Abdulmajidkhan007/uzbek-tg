/**
 * Yangi akkaunt (authorizationStateWaitRegistration): ism, familiya va
 * ixtiyoriy profil rasmi. Rasm registerUser'dan keyin setProfilePhoto bilan
 * yuklanadi. Username va bio kirgandan keyin Sozlamalar'dan o'zgartiriladi.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import * as Haptics from '@/utils/haptics';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { authErrorText, registerUser } from '@/services/tdlib/auth';
import { td } from '@/services/tdlib/client';
import { showAlert } from '@/components/ui/Dialog';

type Props = StackScreenProps<AuthStackParamList, 'ProfileSetup'>;

export function ProfileSetupScreen(_props: Props): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const insets = useSafeAreaInsets();

  const [avatarUri, setAvatarUri] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lastNameRef = useRef<TextInput>(null);

  const canSubmit = firstName.trim().length > 0 && !isSubmitting;

  const pickAvatar = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    const uri = result.assets?.[0]?.uri;
    if (!result.didCancel && uri) setAvatarUri(uri);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);
    try {
      await registerUser(firstName.trim(), lastName.trim());
      if (avatarUri) {
        // Ro'yxatdan o'tgach rasm yuklanadi (xato bo'lsa kirish to'xtamaydi).
        td({
          '@type': 'setProfilePhoto',
          photo: {
            '@type': 'inputChatPhotoStatic',
            photo: { '@type': 'inputFileLocal', path: avatarUri.replace('file://', '') },
          },
          is_public: false,
        }).catch(() => undefined);
      }
      // TDLib "ready" bo'lgach RootNavigator chatlarga o'tkazadi.
    } catch (e) {
      showAlert(t('main.profile.failed'), authErrorText(e));
      setIsSubmitting(false);
    }
  }, [canSubmit, firstName, lastName, avatarUri, t]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.duration(300)} style={styles.head}>
            <TouchableOpacity onPress={() => void pickAvatar()} accessibilityRole="button" accessibilityLabel={t('main.profile.addPhoto')}>
              <View style={[styles.avatar, { backgroundColor: c.surfaceElevated }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="camera" size={38} color={c.primary} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: c.textSecondary }]}>{t('main.profile.addPhoto')}</Text>
            <Text style={[styles.title, { color: c.text }]}>{t('main.profile.title')}</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>{t('main.profile.subtitle')}</Text>
          </Animated.View>

          <TextInput
            style={[styles.input, { color: c.text, borderBottomColor: c.primary }]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t('main.profile.firstName')}
            placeholderTextColor={c.textTertiary}
            returnKeyType="next"
            onSubmitEditing={() => lastNameRef.current?.focus()}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={64}
          />
          <TextInput
            ref={lastNameRef}
            style={[styles.input, { color: c.text, borderBottomColor: c.border }]}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t('main.profile.lastName')}
            placeholderTextColor={c.textTertiary}
            returnKeyType="done"
            onSubmitEditing={() => void handleSubmit()}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={64}
          />

          <TouchableOpacity
            style={[styles.button, { backgroundColor: canSubmit ? c.primary : c.surfaceElevated }]}
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: canSubmit ? '#FFFFFF' : c.textTertiary }]}>
                {t('main.welcome.start')}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 28, paddingTop: 40 },
  head: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 100, height: 100, borderRadius: 50 },
  hint: { fontSize: 13, marginTop: 10 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  input: { fontSize: 18, borderBottomWidth: 1.5, paddingVertical: 10, marginBottom: 22 },
  button: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonText: { fontSize: 17, fontWeight: '600' },
});
