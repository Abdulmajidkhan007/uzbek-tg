import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as Haptics from '@/utils/haptics';
import { useTheme } from '@/hooks/useTheme';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const theme = useTheme();

  const handleActionPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action?.onPress();
  }, [action]);

  return (
    <View
      style={[styles.container, { paddingHorizontal: theme.spacing.xxxl }]}
      accessibilityRole="none"
    >
      <Text
        style={styles.icon}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon}
      </Text>

      <Text
        style={[
          theme.textStyles.headingMedium,
          {
            color: theme.colors.text,
            marginTop: theme.spacing.lg,
            textAlign: 'center',
          },
        ]}
        accessibilityRole="header"
      >
        {title}
      </Text>

      {subtitle != null && (
        <Text
          style={[
            theme.textStyles.bodyMedium,
            {
              color: theme.colors.textSecondary,
              marginTop: theme.spacing.sm,
              textAlign: 'center',
              lineHeight: theme.fontSizes.md * theme.lineHeights.relaxed,
            },
          ]}
        >
          {subtitle}
        </Text>
      )}

      {action != null && (
        <Pressable
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.full,
              paddingVertical: theme.spacing.md,
              paddingHorizontal: theme.spacing.xxl,
              marginTop: theme.spacing.xl,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleActionPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityHint="Activates the primary action"
        >
          <Text
            style={[
              theme.textStyles.buttonMedium,
              { color: theme.colors.textInverse },
            ]}
          >
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 56,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
