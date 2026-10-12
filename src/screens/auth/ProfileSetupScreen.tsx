import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import { launchImageLibrary } from 'react-native-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { authErrorText, registerUser } from '@/services/tdlib/auth';

type Props = StackScreenProps<AuthStackParamList, 'ProfileSetup'>;

const USERNAME_REGEX = /^[a-zA-Z0-9_]*$/;
const BIO_MAX_LENGTH = 70;

export function ProfileSetupScreen(_props: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [avatarUri, setAvatarUri] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [usernameError, setUsernameError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const lastNameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  const isSubmitEnabled = firstName.trim().length > 0 && !isSubmitting;

  const handleAvatarPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Android 13+ photo picker ruxsat so'ramaydi; eski versiyalarda ham
    // ACTION_GET_CONTENT orqali ruxsatsiz ishlaydi.
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    const uri = result.assets?.[0]?.uri;
    if (!result.didCancel && uri) {
      setAvatarUri(uri);
    }
  }, []);

  const handleUsernameChange = useCallback((value: string) => {
    const stripped = value.replace(/^@/, '');
    if (!USERNAME_REGEX.test(stripped)) {
      setUsernameError('Only letters, numbers, and underscores are allowed');
    } else {
      setUsernameError('');
    }
    setUsername(stripped);
  }, []);

  const handleBioChange = useCallback((value: string) => {
    if (value.length <= BIO_MAX_LENGTH) {
      setBio(value);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!isSubmitEnabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSubmitting(true);
    try {
      // Yangi Telegram akkaunti: faqat ism/familiya kerak. Username, bio va
      // rasm kirgandan keyin Sozlamalar'dan o'zgartiriladi.
      await registerUser(firstName.trim(), lastName.trim());
      // TDLib "ready" bo'lgach RootNavigator chatlarga o'tkazadi.
    } catch (e) {
      Alert.alert("Ro'yxatdan o'tib bo'lmadi", authErrorText(e));
      setIsSubmitting(false);
    }
  }, [isSubmitEnabled, firstName, lastName]);

  const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
    },
    header: {
      paddingHorizontal: theme.spacing.xxl,
      paddingTop: theme.spacing.xxl,
      paddingBottom: theme.spacing.xl,
    },
    title: {
      fontSize: theme.fontSizes.display,
      fontWeight: theme.fontWeights.bold,
      color: theme.colors.text,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.textSecondary,
      lineHeight: 22,
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.xxl,
      paddingBottom: Math.max(insets.bottom + theme.spacing.xl, theme.spacing.xxxl),
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: theme.spacing.xxxl,
    },
    avatarWrapper: {
      position: 'relative',
    },
    avatarCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 100,
      height: 100,
      borderRadius: 50,
    },
    cameraOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.background,
    },
    avatarLabel: {
      fontSize: theme.fontSizes.sm,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.md,
    },
    fieldGroup: {
      gap: theme.spacing.xl,
    },
    fieldContainer: {
      gap: theme.spacing.xs,
    },
    fieldLabel: {
      fontSize: theme.fontSizes.xs,
      fontWeight: theme.fontWeights.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingBottom: theme.spacing.sm,
    },
    prefixText: {
      fontSize: theme.fontSizes.lg,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing.xs,
    },
    textInput: {
      flex: 1,
      fontSize: theme.fontSizes.lg,
      color: theme.colors.text,
      paddingVertical: theme.spacing.sm,
    },
    multilineInput: {
      minHeight: 80,
      textAlignVertical: 'top',
    },
    charCounter: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textTertiary,
      textAlign: 'right',
      marginTop: theme.spacing.xs,
    },
    fieldError: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
    },
    optionalLabel: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textTertiary,
      fontWeight: theme.fontWeights.regular,
      textTransform: 'none',
      letterSpacing: 0,
    },
    fieldLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    submitButton: {
      height: 56,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: theme.spacing.xxxl,
    },
    submitButtonActive: {
      backgroundColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    submitButtonDisabled: {
      backgroundColor: theme.colors.surfaceElevated,
    },
    submitButtonText: {
      fontSize: theme.fontSizes.lg,
      fontWeight: theme.fontWeights.semibold,
    },
    submitButtonTextActive: { color: '#FFFFFF' },
    submitButtonTextDisabled: { color: theme.colors.textTertiary },
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Text style={styles.title}>Your Profile</Text>
          <Text style={styles.subtitle}>Enter your name and add a profile photo</Text>
        </Animated.View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarWrapper}
              onPress={handleAvatarPress}
              accessibilityLabel="Choose profile photo"
              accessibilityRole="button"
            >
              <View style={styles.avatarCircle}>
                {avatarUri ? (
                  <Image
                    source={{ uri: avatarUri }}
                    style={styles.avatarImage}
                    accessibilityLabel="Selected profile photo"
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={48}
                    color={theme.colors.textTertiary}
                  />
                )}
              </View>
              <View style={styles.cameraOverlay}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarLabel}>Tap to add a photo</Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(150).duration(300)} style={styles.fieldGroup}>
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>First Name</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Required"
                  placeholderTextColor={theme.colors.textTertiary}
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  accessibilityLabel="First name input, required"
                  maxLength={50}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Last Name</Text>
                <Text style={styles.optionalLabel}>(optional)</Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  ref={lastNameRef}
                  style={styles.textInput}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Optional"
                  placeholderTextColor={theme.colors.textTertiary}
                  returnKeyType="next"
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  autoCapitalize="words"
                  autoCorrect={false}
                  accessibilityLabel="Last name input, optional"
                  maxLength={50}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Username</Text>
                <Text style={styles.optionalLabel}>(optional)</Text>
              </View>
              <View style={styles.inputRow}>
                <Text style={styles.prefixText}>@</Text>
                <TextInput
                  ref={usernameRef}
                  style={styles.textInput}
                  value={username}
                  onChangeText={handleUsernameChange}
                  placeholder="your_username"
                  placeholderTextColor={theme.colors.textTertiary}
                  returnKeyType="next"
                  onSubmitEditing={() => bioRef.current?.focus()}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Username input, optional, letters numbers and underscores only"
                  maxLength={32}
                />
              </View>
              {usernameError.length > 0 && (
                <Text style={styles.fieldError}>{usernameError}</Text>
              )}
            </View>

            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Bio</Text>
                <Text style={styles.optionalLabel}>(optional)</Text>
              </View>
              <View style={[styles.inputRow, { alignItems: 'flex-start' }]}>
                <TextInput
                  ref={bioRef}
                  style={[styles.textInput, styles.multilineInput]}
                  value={bio}
                  onChangeText={handleBioChange}
                  placeholder="A few words about yourself"
                  placeholderTextColor={theme.colors.textTertiary}
                  returnKeyType="done"
                  multiline
                  autoCapitalize="sentences"
                  accessibilityLabel={`Bio input, optional, ${bio.length} of ${BIO_MAX_LENGTH} characters used`}
                  maxLength={BIO_MAX_LENGTH}
                />
              </View>
              <Text style={styles.charCounter}>
                {bio.length}/{BIO_MAX_LENGTH}
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(300)}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitEnabled ? styles.submitButtonActive : styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isSubmitEnabled}
              accessibilityLabel="Start messaging"
              accessibilityRole="button"
              accessibilityState={{ disabled: !isSubmitEnabled }}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={[
                    styles.submitButtonText,
                    isSubmitEnabled
                      ? styles.submitButtonTextActive
                      : styles.submitButtonTextDisabled,
                  ]}
                >
                  Start Messaging
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
