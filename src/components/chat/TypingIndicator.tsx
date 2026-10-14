import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface TypingIndicatorProps {
  userName: string;
}

// ---------------------------------------------------------------------------
// Bouncing dot
// ---------------------------------------------------------------------------
const DOT_ANIMATION_DURATION = 400;
const DOT_STAGGER_MS = 160;
const DOT_BOUNCE_HEIGHT = 5;

function BouncingDot({ delayMs }: { delayMs: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(-DOT_BOUNCE_HEIGHT, { duration: DOT_ANIMATION_DURATION }),
          withTiming(0, { duration: DOT_ANIMATION_DURATION }),
        ),
        -1,
        false,
      ),
    );
  }, [translateY, delayMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[dotStyles.dot, animatedStyle]} />;
}

const dotStyles = StyleSheet.create({
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginHorizontal: 2,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const TypingIndicator = React.memo(function TypingIndicator({
  userName,
}: TypingIndicatorProps) {
  const theme = useTheme();
  const tr = useT();
  const label = tr('chat.action.typingNamed', { name: userName });

  return (
    <View
      style={styles.row}
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: theme.colors.messageBubbleIncoming,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            borderBottomLeftRadius: theme.radius.xs,
            borderBottomRightRadius: theme.radius.lg,
          },
        ]}
      >
        {/* Dots */}
        <View style={styles.dotsContainer}>
          <BouncingDot delayMs={0} />
          <BouncingDot delayMs={DOT_STAGGER_MS} />
          <BouncingDot delayMs={DOT_STAGGER_MS * 2} />
        </View>
      </View>

      {/* Label below the bubble */}
      <Text
        style={[
          styles.label,
          { color: theme.colors.textTertiary, marginLeft: theme.spacing.sm },
        ]}
        numberOfLines={1}
      >
        {label}…
      </Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 18,
  },
  label: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default TypingIndicator;
