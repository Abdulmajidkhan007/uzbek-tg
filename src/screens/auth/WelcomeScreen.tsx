import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity, Image } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';

type Props = StackScreenProps<AuthStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const handleGetStarted = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const handleAlreadyHaveAccount = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingTop: insets.top,
      paddingBottom: Math.max(insets.bottom, theme.spacing.xl),
      paddingHorizontal: theme.spacing.xxl,
    },
    logoArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.xl,
    },
    logoCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 20,
      elevation: 12,
    },
    logoLetter: {
      fontSize: 64,
      fontWeight: '700',
      color: '#FFFFFF',
      lineHeight: 72,
      includeFontPadding: false,
    },
    appName: {
      fontSize: theme.fontSizes.display,
      fontWeight: theme.fontWeights.bold,
      color: theme.colors.text,
      letterSpacing: theme.letterSpacing.tight,
    },
    subtitle: {
      fontSize: theme.fontSizes.lg,
      fontWeight: theme.fontWeights.medium,
      color: theme.colors.textSecondary,
      letterSpacing: theme.letterSpacing.wide,
    },
    bottomArea: {
      paddingBottom: theme.spacing.xl,
      gap: theme.spacing.lg,
      alignItems: 'center',
    },
    getStartedButton: {
      width: '100%',
      height: 56,
      backgroundColor: theme.colors.primary,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 6,
    },
    getStartedText: {
      fontSize: theme.fontSizes.lg,
      fontWeight: theme.fontWeights.semibold,
      color: '#FFFFFF',
    },
    alreadyAccountButton: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
    },
    alreadyAccountText: {
      fontSize: theme.fontSizes.md,
      color: theme.colors.textSecondary,
    },
    termsText: {
      fontSize: theme.fontSizes.xs,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      lineHeight: 18,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoArea}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: 120, height: 120 }}
            accessibilityLabel="Uzbek TG"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={styles.appName}>Uzbek TG</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={styles.subtitle}>Tez. Xavfsiz. Qulay.</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.bottomArea}>
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={handleGetStarted}
          activeOpacity={0.85}
          accessibilityLabel="Boshlash"
          accessibilityRole="button"
        >
          <Text style={styles.getStartedText}>Boshlash</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.alreadyAccountButton}
          onPress={handleAlreadyHaveAccount}
          activeOpacity={0.7}
          accessibilityLabel="I already have an account, go to login"
          accessibilityRole="button"
        >
          <Text style={styles.alreadyAccountText}>Akkauntim bor</Text>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By continuing you agree to our Terms &amp; Privacy Policy
        </Text>
      </Animated.View>
    </View>
  );
}
