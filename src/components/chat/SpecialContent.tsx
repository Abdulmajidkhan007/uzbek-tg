/**
 * Maxsus xabar kontenti: so'rovnoma, kontakt, joylashuv, havola kartochkasi,
 * katta emoji (dice / animatsiyali emoji).
 */
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useT } from '@/i18n';
import type { ChatMessage, LinkPreviewInfo, PollInfo } from '@/stores/chat.store';
import Avatar from '@/components/common/Avatar';
import FormattedText from './FormattedText';
import { useChatLinks } from './linkActions';

interface Colors {
  text: string;
  accent: string;
  fontSize: number;
}

export function PollContent({
  poll,
  colors,
  onVote,
}: {
  poll: PollInfo;
  colors: Colors;
  onVote?: (optionIds: number[]) => Promise<void>;
}): React.JSX.Element {
  const tr = useT();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const showResults = poll.hasVoted || poll.isClosed;
  const canVote = !showResults && !!onVote;

  const vote = async (ids: number[]) => {
    if (!onVote || ids.length === 0) return;
    setSending(true);
    try {
      await onVote(ids);
    } finally {
      setSending(false);
      setSelected(new Set());
    }
  };

  const kind = poll.isClosed
    ? tr('chat.poll.closed')
    : poll.isQuiz
    ? tr(poll.isAnonymous ? 'chat.poll.anonymousQuiz' : 'chat.poll.quiz')
    : tr(poll.isAnonymous ? 'chat.poll.anonymous' : 'chat.poll.public');

  return (
    <View style={{ minWidth: 230 }}>
      <FormattedText
        text={poll.question}
        entities={poll.questionEntities}
        style={{ color: colors.text, fontSize: colors.fontSize, fontWeight: '700', lineHeight: colors.fontSize * 1.3 }}
        linkColor={colors.accent}
      />
      <Text style={[styles.sub, { color: `${colors.text}99` }]}>{kind}</Text>
      {poll.options.map((o) => {
        const idx = Number(o.id);
        const isSel = selected.has(idx);
        return (
          <Pressable
            key={o.id}
            disabled={!canVote || sending}
            onPress={() => {
              if (poll.allowsMultiple) {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(idx)) next.delete(idx);
                  else next.add(idx);
                  return next;
                });
              } else {
                void vote([idx]);
              }
            }}
            style={styles.option}
          >
            {showResults ? (
              <Text style={[styles.percent, { color: colors.text }]}>{o.percent}%</Text>
            ) : (
              <View
                style={[
                  styles.radio,
                  { borderColor: `${colors.text}66`, borderRadius: poll.allowsMultiple ? 4 : 10 },
                  isSel && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
              >
                {isSel ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.optionTop}>
                <Text style={[styles.optionText, { color: colors.text, fontSize: colors.fontSize - 1 }]}>{o.text}</Text>
                {o.isChosen ? <Ionicons name="checkmark-circle" size={14} color={colors.accent} /> : null}
              </View>
              {showResults ? (
                <View style={[styles.bar, { backgroundColor: `${colors.text}22` }]}>
                  <View style={[styles.barFill, { width: `${Math.max(2, o.percent)}%`, backgroundColor: colors.accent }]} />
                </View>
              ) : (
                <View style={[styles.bar, { backgroundColor: `${colors.text}22` }]} />
              )}
            </View>
          </Pressable>
        );
      })}
      {poll.allowsMultiple && canVote && selected.size > 0 ? (
        <Pressable onPress={() => void vote([...selected])} style={styles.voteBtn} disabled={sending}>
          {sending ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={[styles.voteText, { color: colors.accent }]}>{tr('chat.poll.vote')}</Text>
          )}
        </Pressable>
      ) : (
        <Text style={[styles.sub, { color: `${colors.text}99`, textAlign: 'center', marginTop: 6 }]}>
          {poll.totalVoters > 0 ? tr.p('chat.poll.votes', poll.totalVoters) : tr('chat.poll.noVotes')}
        </Text>
      )}
    </View>
  );
}

export function ContactContent({
  contact,
  colors,
}: {
  contact: NonNullable<ChatMessage['contact']>;
  colors: Colors;
}): React.JSX.Element {
  const tr = useT();
  const links = useChatLinks();
  return (
    <View style={{ minWidth: 220 }}>
      <View style={styles.contactRow}>
        <Avatar name={contact.name || contact.phone} size={44} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={1}>
            {contact.name}
          </Text>
          {contact.phone ? (
            <Text
              style={{ color: colors.accent, fontSize: 14 }}
              onPress={() => Linking.openURL(`tel:${contact.phone.replace(/[^\d+]/g, '')}`).catch(() => undefined)}
            >
              {contact.phone.startsWith('+') ? contact.phone : `+${contact.phone}`}
            </Text>
          ) : null}
        </View>
      </View>
      {contact.userId ? (
        <Pressable onPress={() => links.openUser(contact.userId!)} style={[styles.contactBtn, { borderTopColor: `${colors.text}22` }]}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>{tr('chat.contact.message')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LocationContent({
  location,
  colors,
}: {
  location: NonNullable<ChatMessage['location']>;
  colors: Colors;
}): React.JSX.Element {
  const tr = useT();
  const open = () => {
    const { latitude: la, longitude: lo } = location;
    const label = encodeURIComponent(location.title ?? `${la},${lo}`);
    Linking.openURL(`geo:${la},${lo}?q=${la},${lo}(${label})`).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${la},${lo}`).catch(() => undefined),
    );
  };
  return (
    <Pressable onPress={open} style={[styles.locRow, { minWidth: 220 }]} accessibilityRole="button">
      <View style={[styles.locIcon, { backgroundColor: colors.accent }]}>
        <Ionicons name="location" size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.contactName, { color: colors.text }]} numberOfLines={2}>
          {location.title ?? tr('chat.preview.location')}
        </Text>
        <Text style={{ color: `${colors.text}99`, fontSize: 13 }} numberOfLines={2}>
          {location.address ?? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
        </Text>
        <Text style={{ color: colors.accent, fontSize: 13, marginTop: 2 }}>{tr('chat.location.open')}</Text>
      </View>
    </Pressable>
  );
}

export function LinkPreviewCard({ preview, colors }: { preview: LinkPreviewInfo; colors: Colors }): React.JSX.Element | null {
  const links = useChatLinks();
  if (!preview.title && !preview.description && !preview.siteName) return null;
  return (
    <Pressable
      onPress={() => links.openUrl(preview.url)}
      style={[styles.preview, { borderLeftColor: colors.accent, backgroundColor: `${colors.accent}1A` }]}
    >
      {preview.siteName ? (
        <Text style={[styles.site, { color: colors.accent }]} numberOfLines={1}>
          {preview.siteName}
        </Text>
      ) : null}
      {preview.title ? (
        <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
          {preview.title}
        </Text>
      ) : null}
      {preview.description ? (
        <Text style={{ color: colors.text, fontSize: 14, lineHeight: 19 }} numberOfLines={4}>
          {preview.description}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function BigEmoji({ emoji }: { emoji: string }): React.JSX.Element {
  return <Text style={styles.bigEmoji}>{emoji}</Text>;
}

const styles = StyleSheet.create({
  sub: { fontSize: 13, marginTop: 2, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, gap: 8 },
  radio: { width: 20, height: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  percent: { width: 36, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  optionTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  optionText: { flexShrink: 1 },
  bar: { height: 3, borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 2 },
  voteBtn: { alignItems: 'center', paddingVertical: 8 },
  voteText: { fontSize: 15, fontWeight: '600' },
  contactRow: { flexDirection: 'row', alignItems: 'center' },
  contactName: { fontSize: 15, fontWeight: '600' },
  contactBtn: { alignItems: 'center', paddingTop: 8, marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  preview: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginTop: 6 },
  site: { fontSize: 13, fontWeight: '700' },
  previewTitle: { fontSize: 14, fontWeight: '700', marginTop: 1 },
  bigEmoji: { fontSize: 64, lineHeight: 76, textAlign: 'center' },
});
