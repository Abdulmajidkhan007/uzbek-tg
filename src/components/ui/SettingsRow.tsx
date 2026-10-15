/**
 * Telegram uslubidagi sozlamalar qatorlari: rangli ikonka, nom, o'ngda qiymat.
 * Qatorlar <SettingsCard> ichida guruhlanadi.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/hooks/useTheme';

export interface SettingsRowProps {
  icon: string;
  /** Ikonka foni (Telegram'dagi rangli kvadrat). */
  color?: string;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  last?: boolean;
  /** Telegram Premium belgisi (yulduzcha) nom yonida. */
  premium?: boolean;
}

export function SettingsRow({
  icon,
  color,
  label,
  subtitle,
  value,
  onPress,
  danger,
  right,
  last,
  premium,
}: SettingsRowProps): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      android_ripple={{ color: c.surfaceHighlight }}
      style={styles.row}
      accessibilityRole="button"
    >
      <View style={[styles.icon, { backgroundColor: danger ? c.error : color ?? c.primary }]}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
      </View>
      <View style={[styles.body, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.label, { color: danger ? c.error : c.text, flexShrink: 1 }]} numberOfLines={1}>
              {label}
            </Text>
            {premium ? <Ionicons name="star" size={16} color="#A76BF5" style={{ marginLeft: 6 }} /> : null}
          </View>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: c.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {value ? <Text style={[styles.value, { color: c.primary }]}>{value}</Text> : null}
        {right}
      </View>
    </Pressable>
  );
}

export function SettingsCard({
  title,
  children,
  footer,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: string;
  style?: ViewStyle;
}): React.JSX.Element {
  const c = useTheme().colors;
  return (
    <View style={[styles.cardWrap, style]}>
      {title ? <Text style={[styles.cardTitle, { color: c.primary }]}>{title}</Text> : null}
      <View style={[styles.card, { backgroundColor: c.surface }]}>{children}</View>
      {footer ? <Text style={[styles.footer, { color: c.textSecondary }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, minHeight: 52 },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8, paddingRight: 16 },
  label: { fontSize: 16 },
  subtitle: { fontSize: 13.5, marginTop: 2 },
  value: { fontSize: 15, marginLeft: 8 },
  cardWrap: { marginHorizontal: 12, marginTop: 14 },
  cardTitle: { fontSize: 14.5, fontWeight: '600', marginLeft: 16, marginBottom: 6 },
  card: { borderRadius: 14, overflow: 'hidden' },
  footer: { fontSize: 13, marginHorizontal: 16, marginTop: 6, lineHeight: 18 },
});
