/**
 * Xabar ostidagi inline tugmalar (replyMarkupInlineKeyboard) — Telegram uslubida.
 * Ilova bajara olmaydigan tugma turlari xira va bosilmaydigan ko'rinadi.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { InlineButton } from '@/stores/chat.store';

const ACTIVE = new Set(['url', 'loginUrl', 'webApp', 'callback', 'user', 'copyText']);

export function isButtonSupported(b: InlineButton): boolean {
  return ACTIVE.has(b.kind) && (b.kind !== 'callback' || !!b.data);
}

export default function InlineKeyboard({
  rows,
  onPress,
  isDark,
}: {
  rows: InlineButton[][];
  onPress: (b: InlineButton) => Promise<void> | void;
  isDark: boolean;
}): React.JSX.Element {
  const [busy, setBusy] = useState<string | null>(null);
  const bg = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.22)';
  return (
    <View style={styles.wrap}>
      {rows.map((row, ri) => (
        <View key={ri} style={styles.row}>
          {row.map((b, bi) => {
            const key = `${ri}:${bi}`;
            const ok = isButtonSupported(b);
            const icon =
              b.kind === 'url' || b.kind === 'loginUrl'
                ? 'arrow-up-outline'
                : b.kind === 'webApp'
                ? 'apps-outline'
                : b.kind === 'copyText'
                ? 'copy-outline'
                : b.kind === 'user'
                ? 'person-outline'
                : null;
            return (
              <Pressable
                key={key}
                disabled={!ok || busy !== null}
                onPress={async () => {
                  setBusy(key);
                  try {
                    await onPress(b);
                  } finally {
                    setBusy(null);
                  }
                }}
                style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: ok ? (pressed ? 0.7 : 1) : 0.45 }]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !ok }}
              >
                {busy === key ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.text} numberOfLines={2}>
                    {b.text}
                  </Text>
                )}
                {icon && ok ? (
                  <Ionicons
                    name={icon}
                    size={10}
                    color="#FFFFFF"
                    style={[styles.corner, icon === 'arrow-up-outline' && { transform: [{ rotate: '45deg' }] }]}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 3, gap: 3, alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: 3 },
  button: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  corner: { position: 'absolute', top: 4, right: 5 },
});
