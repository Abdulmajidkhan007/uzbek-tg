import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth.store';
import { td } from '@/services/tdlib/client';
import { useUIStore } from '@/stores/ui.store';
import Avatar from '@/components/common/Avatar';
import PressableRow from '@/components/ui/PressableRow';
import Divider from '@/components/ui/Divider';
import type { SettingsStackParamList } from '@/types';
import { showAlert } from '@/components/ui/Dialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<SettingsStackParamList, 'SettingsMain'>;

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface RowItem {
  icon: IoniconName;
  label: string;
  subtitle?: string;
  rightType: 'chevron' | 'toggle' | 'value';
  value?: string;
  toggleKey?: 'inAppSounds' | 'inAppVibration';
  onPress?: () => void;
  danger?: boolean;
}

interface Section {
  title: string;
  items: RowItem[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const SectionHeader = React.memo(function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles.sectionHeader,
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

const RowCell = React.memo(function RowCell({
  item,
  isFirst,
  isLast,
  toggleValue,
  onToggle,
}: {
  item: RowItem;
  isFirst: boolean;
  isLast: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
}) {
  const theme = useTheme();

  const handlePress = useCallback(() => {
    if (item.rightType === 'toggle') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    item.onPress?.();
  }, [item]);

  const content = (
    <View
      style={[
        styles.row,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderTopLeftRadius: isFirst ? theme.radius.md : 0,
          borderTopRightRadius: isFirst ? theme.radius.md : 0,
          borderBottomLeftRadius: isLast ? theme.radius.md : 0,
          borderBottomRightRadius: isLast ? theme.radius.md : 0,
          backgroundColor: theme.colors.surfaceElevated,
        },
      ]}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: item.danger ? theme.colors.error + '22' : theme.colors.primary + '22' },
        ]}
      >
        <Ionicons
          name={item.icon}
          size={18}
          color={item.danger ? theme.colors.error : theme.colors.primary}
        />
      </View>
      <View style={styles.rowContent}>
        <Text
          style={[
            theme.textStyles.bodyMedium,
            { color: item.danger ? theme.colors.error : theme.colors.text },
          ]}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {item.subtitle != null && (
          <Text
            style={[
              theme.textStyles.caption,
              { color: theme.colors.textSecondary, marginTop: 2 },
            ]}
            numberOfLines={1}
          >
            {item.subtitle}
          </Text>
        )}
      </View>
      {item.rightType === 'toggle' && onToggle != null && (
        <Switch
          value={toggleValue ?? false}
          onValueChange={(val) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle(val);
          }}
          trackColor={{ false: theme.colors.textTertiary, true: theme.colors.primary }}
          thumbColor={Platform.OS === 'android' ? theme.colors.text : undefined}
        />
      )}
      {item.rightType === 'value' && item.value != null && (
        <Text
          style={[theme.textStyles.bodySmall, { color: theme.colors.textSecondary }]}
        >
          {item.value}
        </Text>
      )}
      {item.rightType === 'chevron' && (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
      )}
    </View>
  );

  if (item.rightType === 'toggle') {
    return (
      <>
        {content}
        {!isLast && <Divider inset={theme.spacing.lg + 18 + theme.spacing.md} />}
      </>
    );
  }

  return (
    <>
      <PressableRow onPress={handlePress} disabled={!item.onPress}>
        {content}
      </PressableRow>
      {!isLast && <Divider inset={theme.spacing.lg + 18 + theme.spacing.md} />}
    </>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export function SettingsScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const themeMode = useUIStore((s) => s.themeMode);

  const [inAppSounds, setInAppSounds] = useState(true);
  const [inAppVibration, setInAppVibration] = useState(true);

  const userName = currentUser
    ? `${currentUser.firstName}${currentUser.lastName ? ' ' + currentUser.lastName : ''}`
    : 'Unknown User';

  const handleLogout = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showAlert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logout();
          },
        },
      ],
      { cancelable: true }
    );
  }, [logout]);

  const handleClearCache = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showAlert(
      'Clear Cache',
      "Yuklab olingan media fayllar o'chiriladi (xabarlar qoladi). Davom etilsinmi?",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            td({
              '@type': 'optimizeStorage',
              size: 0,
              ttl: 0,
              count: 0,
              immunity_delay: 0,
              return_deleted_file_statistics: false,
              chat_limit: 0,
            })
              .then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
              .catch(() => undefined);
          },
        },
      ]
    );
  }, []);

  const themeLabelMap: Record<string, string> = {
    dark: 'Dark',
    light: 'Light',
    system: 'System',
  };

  const sections: Section[] = [
    {
      title: 'Account',
      items: [
        {
          icon: 'call-outline',
          label: 'Phone Number',
          subtitle: currentUser?.phone ?? '+1 (555) 000-0000',
          rightType: 'chevron',
          onPress: () => navigation.navigate('EditProfile'),
        },
        {
          icon: 'at-outline',
          label: 'Username',
          subtitle: currentUser?.username ? `@${currentUser.username}` : 'Set username',
          rightType: 'chevron',
          onPress: () => navigation.navigate('EditProfile'),
        },
        {
          icon: 'create-outline',
          label: 'Bio',
          subtitle: currentUser?.bio ?? 'Add bio',
          rightType: 'chevron',
          onPress: () => navigation.navigate('EditProfile'),
        },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        {
          icon: 'lock-closed-outline',
          label: 'Privacy Settings',
          rightType: 'chevron',
          onPress: () => navigation.navigate('PrivacySettings'),
        },
        {
          icon: 'ban-outline',
          label: 'Blocked Users',
          rightType: 'chevron',
          onPress: () => navigation.navigate('BlockedUsers'),
        },
        {
          icon: 'shield-checkmark-outline',
          label: 'Two-Step Verification',
          subtitle: 'Add extra security',
          rightType: 'chevron',
          onPress: () => {},
        },
        {
          icon: 'phone-portrait-outline',
          label: 'Active Sessions',
          rightType: 'chevron',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Notifications',
      items: [
        {
          icon: 'notifications-outline',
          label: 'Notification Settings',
          rightType: 'chevron',
          onPress: () => navigation.navigate('NotificationSettings'),
        },
        {
          icon: 'musical-notes-outline',
          label: 'In-App Sounds',
          rightType: 'toggle',
          toggleKey: 'inAppSounds',
        },
        {
          icon: 'phone-portrait-outline',
          label: 'In-App Vibration',
          rightType: 'toggle',
          toggleKey: 'inAppVibration',
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: 'color-palette-outline',
          label: 'Theme',
          subtitle: themeLabelMap[themeMode] ?? 'System',
          rightType: 'chevron',
          onPress: () => navigation.navigate('ThemeSettings'),
        },
        {
          icon: 'text-outline',
          label: 'Text Size',
          subtitle: 'Medium',
          rightType: 'chevron',
          onPress: () => {},
        },
      ],
    },
    {
      title: 'Storage & Data',
      items: [
        {
          icon: 'server-outline',
          label: 'Storage Usage',
          subtitle: '2.4 GB used',
          rightType: 'chevron',
          onPress: () => {},
        },
        {
          icon: 'cloud-download-outline',
          label: 'Auto-Download',
          subtitle: 'Wi-Fi + Mobile Data',
          rightType: 'chevron',
          onPress: () => {},
        },
        {
          icon: 'trash-outline',
          label: 'Clear Cache',
          rightType: 'chevron',
          onPress: handleClearCache,
        },
      ],
    },
    {
      title: 'Help',
      items: [
        {
          icon: 'help-circle-outline',
          label: 'Ask a Question',
          rightType: 'chevron',
          onPress: () => {},
        },
        {
          icon: 'bug-outline',
          label: 'Report a Bug',
          rightType: 'chevron',
          onPress: () => {},
        },
        {
          icon: 'information-circle-outline',
          label: 'About Pulse',
          subtitle: 'Version 1.0.0',
          rightType: 'chevron',
          onPress: () => {},
        },
      ],
    },
  ];

  const toggleValues: Record<string, boolean> = {
    inAppSounds,
    inAppVibration,
  };

  const toggleHandlers: Record<string, (val: boolean) => void> = {
    inAppSounds: setInAppSounds,
    inAppVibration: setInAppVibration,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Custom Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.md,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Text
          style={[
            theme.textStyles.headingLarge,
            { color: theme.colors.text },
          ]}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + theme.spacing.xxxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
          <PressableRow onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('EditProfile');
          }}>
            <View
              style={[
                styles.profileCard,
                {
                  backgroundColor: theme.colors.surfaceElevated,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.lg,
                },
              ]}
            >
              <Avatar
                uri={currentUser?.avatarUrl}
                name={userName}
                size={64}
                showOnline
                isOnline
              />
              <View style={styles.profileInfo}>
                <Text
                  style={[
                    theme.textStyles.headingSmall,
                    { color: theme.colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {userName}
                </Text>
                {currentUser?.username != null && (
                  <Text
                    style={[
                      theme.textStyles.bodySmall,
                      { color: theme.colors.primary, marginTop: 2 },
                    ]}
                    numberOfLines={1}
                  >
                    @{currentUser.username}
                  </Text>
                )}
                <Text
                  style={[
                    theme.textStyles.bodySmall,
                    { color: theme.colors.textSecondary, marginTop: 2 },
                  ]}
                  numberOfLines={1}
                >
                  {currentUser?.phone ?? '+1 (555) 000-0000'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Share profile QR code"
                accessibilityRole="button"
              >
                <Ionicons name="scan-outline" size={22} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </PressableRow>
        </View>

        {/* Settings Sections */}
        {sections.map((section) => (
          <View key={section.title}>
            <SectionHeader title={section.title} />
            <View style={{ paddingHorizontal: theme.spacing.lg }}>
              {section.items.map((item, idx) => (
                <RowCell
                  key={item.label}
                  item={item}
                  isFirst={idx === 0}
                  isLast={idx === section.items.length - 1}
                  toggleValue={item.toggleKey != null ? toggleValues[item.toggleKey] : undefined}
                  onToggle={item.toggleKey != null ? toggleHandlers[item.toggleKey] : undefined}
                />
              ))}
            </View>
          </View>
        ))}

        {/* Log Out */}
        <View
          style={{
            alignItems: 'center',
            marginTop: theme.spacing.xxxl,
            paddingBottom: theme.spacing.xl,
          }}
        >
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
            <Text
              style={[
                theme.textStyles.bodyLarge,
                {
                  color: theme.colors.error,
                  marginLeft: theme.spacing.sm,
                  fontWeight: theme.fontWeights.semibold,
                },
              ]}
            >
              Log Out
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
  },
  sectionHeader: {},
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
