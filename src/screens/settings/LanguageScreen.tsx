/**
 * Ilova tili: o'zbekcha (asosiy), English, Русский.
 * Tanlov darhol qo'llanadi va qurilmada saqlanadi (useUIStore).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/hooks/useTheme';
import { LANGUAGES, useT } from '@/i18n';
import { useUIStore } from '@/stores/ui.store';
import { SettingsCard } from '@/components/ui/SettingsRow';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import * as Haptics from '@/utils/haptics';
import type { SettingsStackParamList } from '@/navigation/types';

type Props = StackScreenProps<SettingsStackParamList, 'Language'>;

export function LanguageScreen({ navigation }: Props): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  const current = useUIStore((s) => s.language);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.background }]} edges={['top']}>
      <ScreenHeader title={t('settings.lang.title')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <SettingsCard title={t('settings.lang.section')}>
          {LANGUAGES.map((l, i) => {
            const selected = l.code === current;
            return (
              <Pressable
                key={l.code}
                onPress={() => {
                  if (selected) return;
                  Haptics.selectionAsync();
                  useUIStore.getState().setLanguage(l.code);
                }}
                android_ripple={{ color: c.surfaceHighlight }}
                style={styles.row}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <View
                  style={[
                    styles.body,
                    i < LANGUAGES.length - 1 && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.native, { color: c.text }]}>{l.native}</Text>
                    <Text style={[styles.name, { color: c.textSecondary }]}>{l.code === 'uz' ? 'Uzbek' : l.name}</Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={24} color={c.primary} /> : null}
                </View>
              </Pressable>
            );
          })}
        </SettingsCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { paddingLeft: 18 },
  body: { flexDirection: 'row', alignItems: 'center', minHeight: 62, paddingVertical: 10, paddingRight: 16 },
  native: { fontSize: 16 },
  name: { fontSize: 14, marginTop: 2 },
});
