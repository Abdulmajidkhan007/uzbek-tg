import React, { useMemo } from 'react';
import { Image, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface AvatarProps {
  uri?: string;
  name: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const FALLBACK_COLORS = [
  '#E53935',
  '#8E24AA',
  '#1E88E5',
  '#00897B',
  '#F4511E',
  '#6D4C41',
  '#039BE5',
  '#43A047',
] as const;

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

function getFallbackColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash * 31) + name.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length] as string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const Avatar = React.memo(function Avatar({
  uri,
  name,
  size = 44,
  showOnline = false,
  isOnline = false,
  style,
}: AvatarProps) {
  const theme = useTheme();

  const initials = useMemo(() => getInitials(name), [name]);
  const fallbackColor = useMemo(() => getFallbackColor(name), [name]);

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const ONLINE_DOT_SIZE = 10;

  return (
    <View
      style={[containerStyle, styles.wrapper, style]}
      accessibilityLabel={`${name}'s avatar`}
      accessibilityRole="image"
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, containerStyle as object]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            containerStyle,
            styles.fallback,
            { backgroundColor: fallbackColor },
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                fontSize: size * 0.38,
                fontWeight: theme.fontWeights.semibold,
              },
            ]}
            allowFontScaling={false}
          >
            {initials}
          </Text>
        </View>
      )}

      {showOnline && isOnline && (
        <View
          style={[
            styles.onlineDot,
            {
              width: ONLINE_DOT_SIZE,
              height: ONLINE_DOT_SIZE,
              borderRadius: ONLINE_DOT_SIZE / 2,
              backgroundColor: theme.colors.onlineDot,
              borderColor: theme.colors.background,
            },
          ]}
        />
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});

export default Avatar;
