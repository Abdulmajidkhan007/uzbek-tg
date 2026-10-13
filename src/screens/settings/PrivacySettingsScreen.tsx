import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Divider from '@/components/ui/Divider';
import type { SettingsStackParamList } from '@/types';
import { showAlert } from '@/components/ui/Dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<SettingsStackParamList, 'PrivacySettings'>;

type VisibilityOption = 'Everybody' | 'My Contacts' | 'Nobody';

interface PrivacyField {
  key: string;
  label: string;
  options: VisibilityOption[];
  value: VisibilityOption;
}

interface ActiveSessionInfo {
  device: string;
  platform: string;
  location: string;
}

const ALL_OPTIONS: VisibilityOption[] = ['Everybody', 'My Contacts', 'Nobody'];
const CONTACTS_NOBODY: VisibilityOption[] = ['My Contacts', 'Nobody'];

const MOCK_SESSION: ActiveSessionInfo = {
  device: 'iPhone 15 Pro',
  platform: 'iOS 17.4',
  location: 'San Francisco, US',
};

const INITIAL_PRIVACY_FIELDS: PrivacyField[] = [
  { key: 'phone', label: 'Phone Number', options: ALL_OPTIONS, value: 'Nobody' },
  { key: 'lastSeen', label: 'Last Seen & Online', options: ALL_OPTIONS, value: 'My Contacts' },
  { key: 'photo', label: 'Profile Photo', options: ALL_OPTIONS, value: 'Everybody' },
  { key: 'bio', label: 'About', options: ALL_OPTIONS, value: 'Everybody' },
  { key: 'calls', label: 'Calls', options: CONTACTS_NOBODY, value: 'My Contacts' },
  { key: 'groups', label: 'Groups & Channels', options: CONTACTS_NOBODY, value: 'My Contacts' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const SectionTitle = React.memo(function SectionTitle({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      style={{
        color: theme.colors.textSecondary,
        fontSize: theme.fontSizes.sm,
        fontWeight: theme.fontWeights.semibold,
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: theme.letterSpacing.wide,
      }}
    >
      {title}
    </Text>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function PrivacySettingsScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [privacyFields, setPrivacyFields] = useState<PrivacyField[]>(INITIAL_PRIVACY_FIELDS);
  const [twoStep, setTwoStep] = useState(false);
  const [activeField, setActiveField] = useState<PrivacyField | null>(null);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);

  const openPicker = useCallback((field: PrivacyField) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveField(field);
  }, []);

  const selectOption = useCallback(
    (option: VisibilityOption) => {
      if (!activeField) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPrivacyFields((prev) =>
        prev.map((f) => (f.key === activeField.key ? { ...f, value: option } : f))
      );
      setActiveField(null);
    },
    [activeField]
  );

  const handleDeleteAccount = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showAlert(
      'Delete Account',
      'If you delete your account, all messages and chats will be permanently lost. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: () => {} },
      ]
    );
  }, []);

  const handleOpenSessions = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSessionModalVisible(true);
  }, []);

  const handleCloseActiveField = useCallback(() => setActiveField(null), []);
  const handleCloseSession = useCallback(() => setSessionModalVisible(false), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
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
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
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
          Privacy
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Who can see my... */}
        <SectionTitle title="Who Can See My..." />
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          {privacyFields.map((field, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === privacyFields.length - 1;
            return (
              <React.Fragment key={field.key}>
                <TouchableOpacity
                  onPress={() => openPicker(field)}
                  accessibilityRole="button"
                  accessibilityLabel={`${field.label}: ${field.value}`}
                >
                  <View
                    style={[
                      styles.row,
                      {
                        paddingHorizontal: theme.spacing.lg,
                        paddingVertical: theme.spacing.md,
                        backgroundColor: theme.colors.surfaceElevated,
                        borderTopLeftRadius: isFirst ? theme.radius.md : 0,
                        borderTopRightRadius: isFirst ? theme.radius.md : 0,
                        borderBottomLeftRadius: isLast ? theme.radius.md : 0,
                        borderBottomRightRadius: isLast ? theme.radius.md : 0,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.textStyles.bodyMedium,
                        { color: theme.colors.text, flex: 1 },
                      ]}
                    >
                      {field.label}
                    </Text>
                    <Text
                      style={[
                        theme.textStyles.bodySmall,
                        { color: theme.colors.textSecondary, marginRight: theme.spacing.xs },
                      ]}
                    >
                      {field.value}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
                  </View>
                </TouchableOpacity>
                {!isLast && <Divider inset={theme.spacing.lg} />}
              </React.Fragment>
            );
          })}
        </View>

        {/* Security */}
        <SectionTitle title="Security" />
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <View
            style={[
              styles.row,
              {
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.md,
                backgroundColor: theme.colors.surfaceElevated,
                borderTopLeftRadius: theme.radius.md,
                borderTopRightRadius: theme.radius.md,
              },
            ]}
          >
            <Text
              style={[theme.textStyles.bodyMedium, { color: theme.colors.text, flex: 1 }]}
            >
              Two-Step Verification
            </Text>
            <Switch
              value={twoStep}
              onValueChange={(val) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTwoStep(val);
              }}
              trackColor={{ false: theme.colors.textTertiary, true: theme.colors.primary }}
              thumbColor={Platform.OS === 'android' ? theme.colors.text : undefined}
            />
          </View>

          <Divider inset={theme.spacing.lg} />

          <TouchableOpacity
            onPress={handleOpenSessions}
            accessibilityRole="button"
            accessibilityLabel="Active sessions"
          >
            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  backgroundColor: theme.colors.surfaceElevated,
                  borderBottomLeftRadius: theme.radius.md,
                  borderBottomRightRadius: theme.radius.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.text }]}>
                  Active Sessions
                </Text>
                <Text
                  style={[
                    theme.textStyles.caption,
                    { color: theme.colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  1 active session
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Advanced */}
        <SectionTitle title="Advanced" />
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            accessibilityRole="button"
            accessibilityLabel="Delete my account"
          >
            <View
              style={[
                styles.row,
                {
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  backgroundColor: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    theme.textStyles.bodyMedium,
                    { color: theme.colors.error, fontWeight: theme.fontWeights.medium },
                  ]}
                >
                  Delete My Account
                </Text>
                <Text
                  style={[
                    theme.textStyles.caption,
                    { color: theme.colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  All messages and chats will be lost
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Privacy Option Picker Modal */}
      <Modal
        visible={activeField !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseActiveField}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
          onPress={handleCloseActiveField}
        >
          <Pressable>
            <View
              style={[
                styles.actionSheet,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderTopLeftRadius: theme.radius.xl,
                  borderTopRightRadius: theme.radius.xl,
                  paddingBottom: insets.bottom + theme.spacing.lg,
                },
              ]}
            >
              <View
                style={[styles.sheetHandle, { backgroundColor: theme.colors.textTertiary }]}
              />
              <Text
                style={[
                  theme.textStyles.headingSmall,
                  {
                    color: theme.colors.text,
                    textAlign: 'center',
                    paddingVertical: theme.spacing.lg,
                    paddingHorizontal: theme.spacing.xl,
                  },
                ]}
              >
                {activeField?.label}
              </Text>
              <Divider />
              {activeField?.options.map((option, idx) => (
                <React.Fragment key={option}>
                  <TouchableOpacity
                    onPress={() => selectOption(option)}
                    style={[
                      styles.sheetOption,
                      {
                        paddingHorizontal: theme.spacing.xl,
                        paddingVertical: theme.spacing.lg,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={option}
                    accessibilityState={{ selected: activeField?.value === option }}
                  >
                    <Text
                      style={[
                        theme.textStyles.bodyLarge,
                        {
                          color:
                            activeField?.value === option
                              ? theme.colors.primary
                              : theme.colors.text,
                          flex: 1,
                        },
                      ]}
                    >
                      {option}
                    </Text>
                    {activeField?.value === option && (
                      <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                  {idx < (activeField?.options.length ?? 0) - 1 && (
                    <Divider inset={theme.spacing.xl} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Active Sessions Modal */}
      <Modal
        visible={sessionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleCloseSession}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.colors.overlay }]}
          onPress={handleCloseSession}
        >
          <Pressable>
            <View
              style={[
                styles.actionSheet,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderTopLeftRadius: theme.radius.xl,
                  borderTopRightRadius: theme.radius.xl,
                  paddingBottom: insets.bottom + theme.spacing.lg,
                },
              ]}
            >
              <View
                style={[styles.sheetHandle, { backgroundColor: theme.colors.textTertiary }]}
              />
              <Text
                style={[
                  theme.textStyles.headingSmall,
                  {
                    color: theme.colors.text,
                    textAlign: 'center',
                    paddingVertical: theme.spacing.lg,
                    paddingHorizontal: theme.spacing.xl,
                  },
                ]}
              >
                Active Sessions
              </Text>
              <Divider />
              <View
                style={{
                  paddingHorizontal: theme.spacing.xl,
                  paddingVertical: theme.spacing.lg,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={[
                    styles.sessionIconBg,
                    { backgroundColor: theme.colors.primary + '22' },
                  ]}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                  <Text
                    style={[
                      theme.textStyles.bodyMedium,
                      { color: theme.colors.text, fontWeight: theme.fontWeights.semibold },
                    ]}
                  >
                    {MOCK_SESSION.device}
                  </Text>
                  <Text
                    style={[
                      theme.textStyles.bodySmall,
                      { color: theme.colors.textSecondary, marginTop: 2 },
                    ]}
                  >
                    {MOCK_SESSION.platform}
                  </Text>
                  <Text
                    style={[
                      theme.textStyles.bodySmall,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {MOCK_SESSION.location}
                  </Text>
                </View>
                <View
                  style={[styles.activeIndicator, { backgroundColor: theme.colors.onlineDot }]}
                />
              </View>
              <Divider />
              <TouchableOpacity
                onPress={handleCloseSession}
                style={[
                  styles.sheetOption,
                  {
                    paddingHorizontal: theme.spacing.xl,
                    paddingVertical: theme.spacing.lg,
                    justifyContent: 'center',
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text
                  style={[
                    theme.textStyles.bodyLarge,
                    { color: theme.colors.primary, textAlign: 'center' },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionSheet: {
    paddingTop: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
