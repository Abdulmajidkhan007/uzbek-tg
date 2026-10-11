import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import Divider from '@/components/ui/Divider';
import type { SettingsStackParamList } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<SettingsStackParamList, 'NotificationSettings'>;

interface NotificationGroup {
  masterToggle: boolean;
  alert: boolean;
  sound: boolean;
  badge: boolean;
}

interface NotificationState {
  privateChats: NotificationGroup;
  groups: NotificationGroup;
  channels: NotificationGroup;
  showPreview: boolean;
  contactJoined: boolean;
}

type GroupKey = 'privateChats' | 'groups' | 'channels';
type GroupToggleKey = keyof NotificationGroup;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DEFAULT_GROUP: NotificationGroup = {
  masterToggle: true,
  alert: true,
  sound: true,
  badge: true,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const SectionTitle = React.memo(function SectionTitle({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles.sectionTitle,
        {
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes.sm,
          fontWeight: theme.fontWeights.semibold,
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.xl,
          paddingBottom: theme.spacing.xs,
          textTransform: 'uppercase',
          letterSpacing: theme.letterSpacing.wide,
        },
      ]}
    >
      {title}
    </Text>
  );
});

interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  isFirst: boolean;
  isLast: boolean;
  indented?: boolean;
  disabled?: boolean;
}

const ToggleRow = React.memo(function ToggleRow({
  label,
  value,
  onValueChange,
  isFirst,
  isLast,
  indented = false,
  disabled = false,
}: ToggleRowProps) {
  const theme = useTheme();

  const handleChange = useCallback(
    (val: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onValueChange(val);
    },
    [onValueChange]
  );

  return (
    <>
      <View
        style={[
          styles.toggleRow,
          {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
            paddingLeft: indented ? theme.spacing.lg + 24 : theme.spacing.lg,
            backgroundColor: theme.colors.surfaceElevated,
            borderTopLeftRadius: isFirst ? theme.radius.md : 0,
            borderTopRightRadius: isFirst ? theme.radius.md : 0,
            borderBottomLeftRadius: isLast ? theme.radius.md : 0,
            borderBottomRightRadius: isLast ? theme.radius.md : 0,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        <Text
          style={[
            theme.textStyles.bodyMedium,
            {
              color: theme.colors.text,
              flex: 1,
            },
          ]}
        >
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={handleChange}
          disabled={disabled}
          trackColor={{
            false: theme.colors.textTertiary,
            true: theme.colors.primary,
          }}
          thumbColor={Platform.OS === 'android' ? theme.colors.text : undefined}
        />
      </View>
      {!isLast && <Divider inset={indented ? theme.spacing.lg + 24 : theme.spacing.lg} />}
    </>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function NotificationSettingsScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<NotificationState>({
    privateChats: { ...DEFAULT_GROUP },
    groups: { ...DEFAULT_GROUP },
    channels: { ...DEFAULT_GROUP },
    showPreview: true,
    contactJoined: true,
  });

  const setGroupToggle = useCallback(
    (group: GroupKey, key: GroupToggleKey, val: boolean) => {
      setState((prev) => ({
        ...prev,
        [group]: { ...prev[group], [key]: val },
      }));
    },
    []
  );

  const handleResetAll = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Reset Notifications',
      'All notification settings will be reset to defaults.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setState({
              privateChats: { ...DEFAULT_GROUP },
              groups: { ...DEFAULT_GROUP },
              channels: { ...DEFAULT_GROUP },
              showPreview: true,
              contactJoined: true,
            });
          },
        },
      ]
    );
  }, []);

  const renderGroup = useCallback(
    (groupKey: GroupKey, title: string) => {
      const g = state[groupKey];
      const subDisabled = !g.masterToggle;
      return (
        <View key={groupKey}>
          <SectionTitle title={title} />
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            <ToggleRow
              label="Notifications"
              value={g.masterToggle}
              onValueChange={(val) => setGroupToggle(groupKey, 'masterToggle', val)}
              isFirst
              isLast={false}
            />
            <ToggleRow
              label="Alert"
              value={g.alert}
              onValueChange={(val) => setGroupToggle(groupKey, 'alert', val)}
              isFirst={false}
              isLast={false}
              indented
              disabled={subDisabled}
            />
            <ToggleRow
              label="Sound"
              value={g.sound}
              onValueChange={(val) => setGroupToggle(groupKey, 'sound', val)}
              isFirst={false}
              isLast={false}
              indented
              disabled={subDisabled}
            />
            <ToggleRow
              label="Badge Counter"
              value={g.badge}
              onValueChange={(val) => setGroupToggle(groupKey, 'badge', val)}
              isFirst={false}
              isLast
              indented
              disabled={subDisabled}
            />
          </View>
        </View>
      );
    },
    [state, setGroupToggle, theme.spacing.lg]
  );

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
          Notifications
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {renderGroup('privateChats', 'Private Chats')}
        {renderGroup('groups', 'Groups')}
        {renderGroup('channels', 'Channels')}

        {/* Other */}
        <SectionTitle title="Other" />
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <ToggleRow
            label="Show Message Preview"
            value={state.showPreview}
            onValueChange={(val) => setState((prev) => ({ ...prev, showPreview: val }))}
            isFirst
            isLast={false}
          />
          <ToggleRow
            label="Contact Joined Pulse"
            value={state.contactJoined}
            onValueChange={(val) => setState((prev) => ({ ...prev, contactJoined: val }))}
            isFirst={false}
            isLast
          />
        </View>

        {/* Reset */}
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
            marginTop: theme.spacing.xxl,
          }}
        >
          <TouchableOpacity
            onPress={handleResetAll}
            style={[
              styles.resetButton,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.md,
                paddingVertical: theme.spacing.md,
                paddingHorizontal: theme.spacing.lg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset all notifications"
          >
            <Text
              style={[
                theme.textStyles.bodyMedium,
                {
                  color: theme.colors.error,
                  fontWeight: theme.fontWeights.medium,
                  textAlign: 'center',
                },
              ]}
            >
              Reset All Notifications
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  sectionTitle: {},
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  resetButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
