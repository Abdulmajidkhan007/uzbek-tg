import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';

/** Oddiy sarlavha: orqaga tugmasi + nom (+ ixtiyoriy o'ng tugma). */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}): React.JSX.Element {
  const c = useTheme().colors;
  const t = useT();
  return (
    <View style={[styles.header, { backgroundColor: c.surface }]}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.back} accessibilityLabel={t('common.back')} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
      ) : null}
      <Text style={[styles.title, { color: c.text }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  back: { paddingRight: 20, paddingVertical: 6 },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
});
