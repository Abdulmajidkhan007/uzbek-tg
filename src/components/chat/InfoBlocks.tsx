/**
 * Guruh / kanal / profil ma'lumot ekranlari uchun umumiy bloklar.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Clipboard from '@react-native-clipboard/clipboard';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import Avatar from '@/components/common/Avatar';
import type { UserPreview } from '@/stores/chat.store';
import { loadSharedMediaCounts, type SharedMediaCounts } from '@/services/tdlib/chats';
import { userStatusLabel } from './chatFormat';

export function SectionTitle({ title }: { title: string }): React.JSX.Element {
  const theme = useTheme();
  return (
    <Text style={[styles.section, { color: theme.colors.primary }]}>{title}</Text>
  );
}

/** Ma'lumot qatori; uzoq bosilsa qiymat nusxalanadi. */
export function InfoRow({
  icon,
  label,
  value,
  onPress,
  onCopied,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  onCopied?: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        Clipboard.setString(value);
        onCopied?.();
      }}
      style={({ pressed }) => [styles.infoRow, { backgroundColor: pressed ? theme.colors.surfaceHighlight : theme.colors.surface }]}
    >
      <Ionicons name={icon} size={22} color={theme.colors.textSecondary} style={{ width: 28, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={[theme.textStyles.bodyMedium, { color: onPress ? theme.colors.link : theme.colors.text }]}>{value}</Text>
        <Text style={[theme.textStyles.caption, { color: theme.colors.textSecondary, marginTop: 2 }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function ActionButton({
  icon,
  label,
  onPress,
  color,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}): React.JSX.Element {
  const theme = useTheme();
  const c = color ?? theme.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        { backgroundColor: pressed ? theme.colors.surfaceHighlight : theme.colors.surfaceElevated, borderRadius: theme.radius.md },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={22} color={c} />
      <Text style={[theme.textStyles.caption, { color: c, marginTop: 4, fontWeight: theme.fontWeights.medium, textAlign: 'center' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MemberRow({
  member,
  role,
  onPress,
}: {
  member: UserPreview;
  role?: string;
  onPress: () => void;
}): React.JSX.Element {
  const theme = useTheme();
  const tr = useT();
  const fullName = `${member.firstName}${member.lastName ? ` ${member.lastName}` : ''}`;
  const online = member.status === 'online';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.memberRow, { backgroundColor: pressed ? theme.colors.surfaceHighlight : theme.colors.surface }]}
      accessibilityRole="button"
      accessibilityLabel={fullName}
    >
      <Avatar uri={member.avatarUrl} name={fullName} size={44} showOnline isOnline={online} />
      <View style={{ flex: 1 }}>
        <Text style={[theme.textStyles.chatName, { color: theme.colors.text }]} numberOfLines={1}>
          {fullName}
        </Text>
        <Text style={[theme.textStyles.bodySmall, { color: online ? theme.colors.primary : theme.colors.textSecondary }]} numberOfLines={1}>
          {userStatusLabel(tr, member)}
        </Text>
      </View>
      {role ? <Text style={[theme.textStyles.caption, { color: theme.colors.textSecondary }]}>{role}</Text> : null}
    </Pressable>
  );
}

/** Umumiy media sonlari (serverdan, getChatMessageCount). Hammasi 0 bo'lsa ko'rsatilmaydi. */
export function SharedMediaSection({ chatId }: { chatId: string }): React.JSX.Element | null {
  const theme = useTheme();
  const tr = useT();
  const [counts, setCounts] = useState<SharedMediaCounts | null>(null);
  useEffect(() => {
    let alive = true;
    loadSharedMediaCounts(chatId)
      .then((c) => alive && setCounts(c))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [chatId]);
  if (!counts) return null;
  const rows: { icon: string; label: string; n: number }[] = [
    { icon: 'images-outline', label: tr('chat.info.media'), n: counts.media },
    { icon: 'document-outline', label: tr('chat.info.files'), n: counts.files },
    { icon: 'link-outline', label: tr('chat.info.links'), n: counts.links },
    { icon: 'mic-outline', label: tr('chat.info.voice'), n: counts.voice },
    { icon: 'musical-notes-outline', label: tr('chat.info.audio'), n: counts.audio },
  ].filter((r) => r.n > 0);
  if (rows.length === 0) return null;
  return (
    <View>
      <SectionTitle title={tr('chat.info.sharedMedia')} />
      {rows.map((r) => (
        <View key={r.icon} style={[styles.mediaRow, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name={r.icon} size={22} color={theme.colors.textSecondary} style={{ width: 28 }} />
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.text, flex: 1 }]}>{r.label}</Text>
          <Text style={[theme.textStyles.bodyMedium, { color: theme.colors.textSecondary }]}>{r.n}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 15, fontWeight: '600', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 4, maxWidth: 110 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
});
