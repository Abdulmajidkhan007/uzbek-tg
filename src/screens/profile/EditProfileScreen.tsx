import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import { launchImageLibrary } from 'react-native-image-picker';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { td } from '@/services/tdlib/client';
import Avatar from '@/components/common/Avatar';
import type { SettingsStackParamList } from '@/navigation/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<SettingsStackParamList, 'EditProfile'>;

const USERNAME_REGEX = /^[a-zA-Z0-9_.]{0,32}$/;
const BIO_MAX = 70;

interface FormState {
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  avatarUri: string;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function EditProfileScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [form, setForm] = useState<FormState>({
    firstName: currentUser?.firstName ?? '',
    lastName: currentUser?.lastName ?? '',
    username: currentUser?.username ?? '',
    bio: currentUser?.bio ?? '',
    avatarUri: currentUser?.avatarUrl ?? '',
  });

  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const originalRef = useRef<FormState>({
    firstName: currentUser?.firstName ?? '',
    lastName: currentUser?.lastName ?? '',
    username: currentUser?.username ?? '',
    bio: currentUser?.bio ?? '',
    avatarUri: currentUser?.avatarUrl ?? '',
  });

  const isDirty =
    form.firstName !== originalRef.current.firstName ||
    form.lastName !== originalRef.current.lastName ||
    form.username !== originalRef.current.username ||
    form.bio !== originalRef.current.bio ||
    form.avatarUri !== originalRef.current.avatarUri;

  const canSave = isDirty && form.firstName.trim().length > 0 && usernameError === null;

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleUsernameChange = useCallback(
    (text: string) => {
      const cleaned = text.replace(/^@+/, '');
      if (!USERNAME_REGEX.test(cleaned)) {
        setUsernameError('Only letters, numbers, underscores, and dots allowed');
      } else {
        setUsernameError(null);
      }
      updateField('username', cleaned);
    },
    [updateField]
  );

  const handlePickImage = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
    if (result.errorCode != null) {
      Alert.alert('Rasm tanlanmadi', result.errorMessage ?? result.errorCode);
      return;
    }
    const uri = result.assets?.[0]?.uri;
    if (!result.didCancel && uri != null) {
      updateField('avatarUri', uri);
    }
  }, [updateField]);

  const handleSave = useCallback(async () => {
    if (!canSave || isSaving || currentUser == null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    try {
      const orig = originalRef.current;
      if (form.firstName !== orig.firstName || form.lastName !== orig.lastName) {
        await td({ '@type': 'setName', first_name: form.firstName.trim(), last_name: form.lastName.trim() });
      }
      if (form.username !== orig.username) {
        await td({ '@type': 'setUsername', username: form.username.trim() });
      }
      if (form.bio !== orig.bio) {
        await td({ '@type': 'setBio', bio: form.bio.trim() });
      }
      if (form.avatarUri !== orig.avatarUri && form.avatarUri.startsWith('file://')) {
        await td({
          '@type': 'setProfilePhoto',
          photo: {
            '@type': 'inputChatPhotoStatic',
            photo: { '@type': 'inputFileLocal', path: form.avatarUri.replace('file://', '') },
          },
          is_public: false,
        });
      }
      // Yangi qiymatlar updateUser orqali useAuthStore'ga qaytadi.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      originalRef.current = { ...form };
      navigation.goBack();
    } catch (e) {
      Alert.alert('Saqlanmadi', e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  }, [canSave, isSaving, currentUser, form, navigation]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isDirty) {
      Alert.alert(
        'Discard Changes',
        'You have unsaved changes. Discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [isDirty, navigation]);

  const fullName = `${form.firstName}${form.lastName ? ' ' + form.lastName : ''}`;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            backgroundColor: theme.colors.background,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text
          style={[
            theme.textStyles.headingSmall,
            { color: theme.colors.text, flex: 1, marginLeft: theme.spacing.sm },
          ]}
        >
          Edit Profile
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave || isSaving}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          accessibilityState={{ disabled: !canSave || isSaving }}
        >
          <Text
            style={[
              theme.textStyles.bodyMedium,
              {
                color:
                  canSave && !isSaving
                    ? theme.colors.primary
                    : theme.colors.textTertiary,
                fontWeight: theme.fontWeights.semibold,
              },
            ]}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + theme.spacing.xxxl,
          paddingTop: theme.spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar Section */}
        <TouchableOpacity
          onPress={handlePickImage}
          style={styles.avatarSection}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          <View style={styles.avatarWrapper}>
            <Avatar
              uri={form.avatarUri !== '' ? form.avatarUri : undefined}
              name={fullName !== '' ? fullName : 'User'}
              size={90}
            />
            <View
              style={[
                styles.cameraOverlay,
                { backgroundColor: 'rgba(0,0,0,0.45)' },
              ]}
            >
              <Ionicons name="camera" size={24} color="#FFFFFF" />
            </View>
          </View>
          <Text
            style={[
              theme.textStyles.bodySmall,
              {
                color: theme.colors.primary,
                marginTop: theme.spacing.sm,
                fontWeight: theme.fontWeights.medium,
              },
            ]}
          >
            Change Photo
          </Text>
        </TouchableOpacity>

        {/* Name Section */}
        <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.xl }}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            NAME
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
              overflow: 'hidden',
            }}
          >
            <View
              style={[
                styles.fieldRow,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  theme.textStyles.bodySmall,
                  { color: theme.colors.textSecondary, width: 90 },
                ]}
              >
                First Name *
              </Text>
              <TextInput
                value={form.firstName}
                onChangeText={(t) => updateField('firstName', t)}
                placeholder="First name"
                placeholderTextColor={theme.colors.textTertiary}
                style={[
                  theme.textStyles.bodyMedium,
                  styles.textInput,
                  { color: theme.colors.text },
                ]}
                maxLength={64}
                returnKeyType="next"
                autoCapitalize="words"
                accessibilityLabel="First name"
              />
            </View>
            <View
              style={[
                styles.fieldRow,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                },
              ]}
            >
              <Text
                style={[
                  theme.textStyles.bodySmall,
                  { color: theme.colors.textSecondary, width: 90 },
                ]}
              >
                Last Name
              </Text>
              <TextInput
                value={form.lastName}
                onChangeText={(t) => updateField('lastName', t)}
                placeholder="Last name (optional)"
                placeholderTextColor={theme.colors.textTertiary}
                style={[
                  theme.textStyles.bodyMedium,
                  styles.textInput,
                  { color: theme.colors.text },
                ]}
                maxLength={64}
                returnKeyType="next"
                autoCapitalize="words"
                accessibilityLabel="Last name"
              />
            </View>
          </View>
        </View>

        {/* Username */}
        <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.xl }}>
          <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
            USERNAME
          </Text>
          <View
            style={{
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
            }}
          >
            <View
              style={[
                styles.fieldRow,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                },
              ]}
            >
              <Text
                style={[
                  theme.textStyles.bodyMedium,
                  { color: theme.colors.textSecondary, marginRight: 2 },
                ]}
              >
                @
              </Text>
              <TextInput
                value={form.username}
                onChangeText={handleUsernameChange}
                placeholder="username"
                placeholderTextColor={theme.colors.textTertiary}
                style={[
                  theme.textStyles.bodyMedium,
                  styles.textInput,
                  { color: theme.colors.text },
                ]}
                maxLength={32}
                returnKeyType="next"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Username"
              />
              {form.username.length > 0 && usernameError === null && (
                <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
              )}
              {usernameError !== null && (
                <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
              )}
            </View>
          </View>
          {usernameError !== null && (
            <Text
              style={[
                theme.textStyles.caption,
                {
                  color: theme.colors.error,
                  marginTop: theme.spacing.xs,
                  marginLeft: theme.spacing.sm,
                },
              ]}
            >
              {usernameError}
            </Text>
          )}
        </View>

        {/* Bio */}
        <View style={{ paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.xl }}>
          <View style={styles.bioHeader}>
            <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>
              BIO
            </Text>
            <Text
              style={[
                theme.textStyles.caption,
                {
                  color:
                    form.bio.length >= BIO_MAX
                      ? theme.colors.error
                      : theme.colors.textTertiary,
                },
              ]}
            >
              {form.bio.length}/{BIO_MAX}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
            }}
          >
            <TextInput
              value={form.bio}
              onChangeText={(t) => {
                if (t.length <= BIO_MAX) updateField('bio', t);
              }}
              placeholder="Write something about yourself..."
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              style={[
                theme.textStyles.bodyMedium,
                {
                  color: theme.colors.text,
                  minHeight: 80,
                  textAlignVertical: 'top',
                  padding: 0,
                },
              ]}
              maxLength={BIO_MAX}
              accessibilityLabel="Bio"
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    padding: 0,
  },
  bioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
});
