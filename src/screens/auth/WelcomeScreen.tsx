import React, { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import type { AuthStackParamList } from '@/navigation/types';
import { useTheme } from '@/hooks/useTheme';
import { LANGUAGES, useT } from '@/i18n';
import { useUIStore } from '@/stores/ui.store';
import * as Haptics from '@/utils/haptics';

type Props = StackScreenProps<AuthStackParamList, 'Welcome'>;

/** Kirish oldidan birinchi ekran: logo, shior, til tanlash va "Boshlash". */
export function WelcomeScreen({ navigation }: Props): React.JSX.Element {
  const theme = useTheme();
  const c = theme.colors;
  const t = useT();
  const insets = useSafeAreaInsets();

  const handleStart = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: c.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) },
      ]}
    >
      <View style={styles.langRow}>
        {LANGUAGES.map((l) => {
          const on = t.lang === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => {
                Haptics.selectionAsync();
                useUIStore.getState().setLanguage(l.code);
              }}
              style={[
                styles.langChip,
                { backgroundColor: on ? c.primary : c.surface, borderColor: on ? c.primary : c.border },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={l.native}
            >
              <Text style={[styles.langText, { color: on ? '#FFFFFF' : c.text }]}>{l.code.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.logoArea}>
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} accessibilityLabel="Uzbek TG" />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={[styles.appName, { color: c.text }]}>Uzbek TG</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[styles.tagline, { color: c.textSecondary }]}>{t('main.welcome.tagline')}</Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.bottomArea}>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: c.primary }]}
          onPress={handleStart}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.startText}>{t('main.welcome.start')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28 },
  langRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 12 },
  langChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  langText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  logoArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  logo: { width: 120, height: 120 },
  appName: { fontSize: 30, fontWeight: '700' },
  tagline: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  bottomArea: { paddingBottom: 16 },
  startButton: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  startText: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
});
