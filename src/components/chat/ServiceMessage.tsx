/**
 * Xizmat xabari va sana ajratkichi: markazdagi shaffof "pill".
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function ServicePill({
  text,
  onLongPress,
  highlighted,
}: {
  text: string;
  onLongPress?: () => void;
  highlighted?: boolean;
}): React.JSX.Element {
  const { isDark } = useTheme();
  return (
    <View style={[styles.row, highlighted && styles.highlight]}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={350}
        disabled={!onLongPress}
        style={[styles.pill, { backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.25)' }]}
      >
        <Text style={styles.text}>{text}</Text>
      </Pressable>
    </View>
  );
}

export const DateSeparator = React.memo(function DateSeparator({ label }: { label: string }) {
  return <ServicePill text={label} />;
});

const styles = StyleSheet.create({
  row: { alignItems: 'center', marginVertical: 6, paddingHorizontal: 24 },
  highlight: { backgroundColor: 'rgba(80,160,230,0.18)' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, maxWidth: '100%' },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
});
