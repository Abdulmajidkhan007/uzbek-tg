import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/ui.store';
import type { SettingsStackParamList } from '@/types';
import type { ThemeMode } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Props = StackScreenProps<SettingsStackParamList, 'ThemeSettings'>;

type TextSizeOption = 'Small' | 'Medium' | 'Large';

interface AccentColor {
  name: string;
  hex: string;
}

interface ThemeOptionConfig {
  mode: ThemeMode;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const THEME_OPTIONS: ThemeOptionConfig[] = [
  { mode: 'dark', label: 'Dark' },
  { mode: 'light', label: 'Light' },
  { mode: 'system', label: 'System' },
];

const ACCENT_COLORS: AccentColor[] = [
  { name: 'Blue', hex: '#3D9AE8' },
  { name: 'Green', hex: '#4CAF80' },
  { name: 'Purple', hex: '#9C27B0' },
  { name: 'Orange', hex: '#E8963D' },
  { name: 'Red', hex: '#FF5252' },
  { name: 'Teal', hex: '#009688' },
];

const TEXT_SIZES: TextSizeOption[] = ['Small', 'Medium', 'Large'];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Mini mock chat preview rendered inside a theme card */
const MiniChatPreview = React.memo(function MiniChatPreview({
  isDark,
}: {
  isDark: boolean;
}) {
  const bg = isDark ? '#0F1923' : '#F5F7FA';
  const bubbleOut = isDark ? '#1E5799' : '#2B7BE0';
  const bubbleIn = isDark ? '#1A2633' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0F1923';

  return (
    <View style={[styles.miniChat, { backgroundColor: bg }]}>
      {/* Incoming bubble */}
      <View style={[styles.miniBubbleRow, { justifyContent: 'flex-start' }]}>
        <View
          style={[
            styles.miniBubble,
            { backgroundColor: bubbleIn, maxWidth: 90 },
          ]}
        >
          <View style={[styles.miniTextLine, { backgroundColor: textColor + '55', width: 60 }]} />
          <View style={[styles.miniTextLine, { backgroundColor: textColor + '33', width: 40, marginTop: 3 }]} />
        </View>
      </View>
      {/* Outgoing bubble */}
      <View style={[styles.miniBubbleRow, { justifyContent: 'flex-end' }]}>
        <View
          style={[
            styles.miniBubble,
            { backgroundColor: bubbleOut, maxWidth: 90 },
          ]}
        >
          <View style={[styles.miniTextLine, { backgroundColor: '#FFFFFF88', width: 72 }]} />
          <View style={[styles.miniTextLine, { backgroundColor: '#FFFFFF55', width: 50, marginTop: 3 }]} />
        </View>
      </View>
    </View>
  );
});

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
        paddingBottom: theme.spacing.md,
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
export function ThemeSettingsScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);

  const [selectedAccent, setSelectedAccent] = useState<string>(ACCENT_COLORS[0]?.hex ?? '#3D9AE8');
  const [selectedTextSize, setSelectedTextSize] = useState<TextSizeOption>('Medium');

  const handleSelectTheme = useCallback(
    (mode: ThemeMode) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setThemeMode(mode);
    },
    [setThemeMode]
  );

  const handleSelectAccent = useCallback((hex: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAccent(hex);
  }, []);

  const handleSelectTextSize = useCallback((size: TextSizeOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedTextSize(size);
  }, []);

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
          Theme
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + theme.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme Options */}
        <SectionTitle title="Appearance" />
        <View
          style={[
            styles.themeRow,
            { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
          ]}
        >
          {THEME_OPTIONS.map(({ mode, label }) => {
            const isSelected = themeMode === mode;
            const previewDark = mode === 'dark' || (mode === 'system');
            return (
              <Pressable
                key={mode}
                onPress={() => handleSelectTheme(mode)}
                style={({ pressed }) => [
                  styles.themeCard,
                  {
                    backgroundColor: theme.colors.surfaceElevated,
                    borderRadius: theme.radius.md,
                    borderWidth: 2,
                    borderColor: isSelected ? theme.colors.primary : 'transparent',
                    flex: 1,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                accessibilityRole="radio"
                accessibilityLabel={`${label} theme`}
                accessibilityState={{ selected: isSelected }}
              >
                <MiniChatPreview isDark={previewDark} />
                <View
                  style={[
                    styles.themeCardFooter,
                    {
                      padding: theme.spacing.sm,
                      borderTopColor: theme.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.textStyles.bodySmall,
                      {
                        color: isSelected ? theme.colors.primary : theme.colors.text,
                        fontWeight: isSelected ? theme.fontWeights.semibold : theme.fontWeights.regular,
                        flex: 1,
                        textAlign: 'center',
                      },
                    ]}
                  >
                    {label}
                  </Text>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color={theme.colors.primary}
                    />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Accent Color */}
        <SectionTitle title="Accent Color" />
        <View
          style={{
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <View
            style={[
              styles.accentContainer,
              {
                backgroundColor: theme.colors.surfaceElevated,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.spacing.lg,
                paddingVertical: theme.spacing.lg,
                gap: theme.spacing.md,
              },
            ]}
          >
            {ACCENT_COLORS.map((accent) => {
              const isSelected = selectedAccent === accent.hex;
              return (
                <TouchableOpacity
                  key={accent.hex}
                  onPress={() => handleSelectAccent(accent.hex)}
                  style={[
                    styles.accentDot,
                    {
                      backgroundColor: accent.hex,
                      borderWidth: isSelected ? 3 : 0,
                      borderColor: theme.colors.text,
                      transform: [{ scale: isSelected ? 1.2 : 1 }],
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityLabel={`${accent.name} accent`}
                  accessibilityState={{ selected: isSelected }}
                >
                  {isSelected && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Text Size */}
        <SectionTitle title="Text Size" />
        <View style={{ paddingHorizontal: theme.spacing.lg }}>
          <View
            style={{
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
              overflow: 'hidden',
            }}
          >
            {TEXT_SIZES.map((size, idx) => {
              const isSelected = selectedTextSize === size;
              const isLast = idx === TEXT_SIZES.length - 1;
              return (
                <React.Fragment key={size}>
                  <TouchableOpacity
                    onPress={() => handleSelectTextSize(size)}
                    style={[
                      styles.textSizeRow,
                      {
                        paddingHorizontal: theme.spacing.lg,
                        paddingVertical: theme.spacing.md,
                        backgroundColor: isSelected
                          ? theme.colors.primary + '18'
                          : 'transparent',
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${size} text size`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        theme.textStyles.bodyMedium,
                        {
                          color: isSelected ? theme.colors.primary : theme.colors.text,
                          fontWeight: isSelected
                            ? theme.fontWeights.semibold
                            : theme.fontWeights.regular,
                          flex: 1,
                          fontSize:
                            size === 'Small'
                              ? theme.fontSizes.sm
                              : size === 'Large'
                              ? theme.fontSizes.lg
                              : theme.fontSizes.md,
                        },
                      ]}
                    >
                      {size}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                  {!isLast && (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: theme.colors.border,
                        marginLeft: theme.spacing.lg,
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Preview text */}
          <View
            style={{
              backgroundColor: theme.colors.surfaceElevated,
              borderRadius: theme.radius.md,
              padding: theme.spacing.lg,
              marginTop: theme.spacing.md,
            }}
          >
            <Text
              style={[
                theme.textStyles.caption,
                { color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
              ]}
            >
              Preview
            </Text>
            <Text
              style={{
                color: theme.colors.text,
                fontSize:
                  selectedTextSize === 'Small'
                    ? theme.fontSizes.sm
                    : selectedTextSize === 'Large'
                    ? theme.fontSizes.lg
                    : theme.fontSizes.md,
                lineHeight:
                  (selectedTextSize === 'Small'
                    ? theme.fontSizes.sm
                    : selectedTextSize === 'Large'
                    ? theme.fontSizes.lg
                    : theme.fontSizes.md) * theme.lineHeights.relaxed,
              }}
            >
              Hey! How are you doing today? Let me know if you want to grab coffee later.
            </Text>
          </View>
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
  themeRow: {
    flexDirection: 'row',
  },
  themeCard: {
    overflow: 'hidden',
  },
  themeCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  miniChat: {
    height: 96,
    padding: 8,
    justifyContent: 'space-around',
  },
  miniBubbleRow: {
    flexDirection: 'row',
  },
  miniBubble: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  miniTextLine: {
    height: 5,
    borderRadius: 3,
  },
  accentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
});
