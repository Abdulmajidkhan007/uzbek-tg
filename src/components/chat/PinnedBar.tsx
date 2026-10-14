/**
 * Chat tepasidagi qadalgan xabar paneli: bosilsa xabarga o'tadi, X — yashiradi.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import type { ChatMessage } from '@/stores/chat.store';

const PinnedBar = React.memo(function PinnedBar({
  message,
  onPress,
  onDismiss,
}: {
  message: ChatMessage;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const tr = useT();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.container, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}
      accessibilityRole="button"
    >
      <View style={[styles.accent, { backgroundColor: theme.colors.primary }]} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.colors.primary }]}>{tr('chat.pinnedMessage')}</Text>
        <Text style={[styles.preview, { color: theme.colors.text }]} numberOfLines={1}>
          {message.previewText ?? message.text ?? ''}
        </Text>
      </View>
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('common.close')}>
        <Ionicons name="close" size={20} color={theme.colors.textTertiary} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accent: { width: 2, alignSelf: 'stretch', borderRadius: 1, marginRight: 10 },
  text: { flex: 1, marginRight: 8 },
  title: { fontSize: 14, fontWeight: '600' },
  preview: { fontSize: 14 },
});

export default PinnedBar;
