/**
 * Telegram formatlangan matni (formattedText.entities): qalin, kursiv, tagiga
 * chizilgan, o'chirilgan, kod, pre-blok, spoiler, iqtibos va bosiladigan
 * havolalar (url, mention, hashtag, bot buyruq, telefon, email).
 * Offset/length — UTF-16 birliklarda, JS satrlari bilan bir xil.
 */
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import type { TextEntity } from '@/stores/chat.store';
import { useChatLinks, type ChatLinkHandlers } from './linkActions';

const BLOCK_TYPES = new Set(['Pre', 'PreCode', 'BlockQuote', 'ExpandableBlockQuote']);
const LINK_TYPES = new Set(['Url', 'TextUrl', 'Mention', 'MentionName', 'Hashtag', 'Cashtag', 'BotCommand', 'EmailAddress', 'PhoneNumber']);
const MONO = Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' });

export interface FormattedTextProps {
  text: string;
  entities?: readonly TextEntity[];
  style: TextStyle;
  linkColor: string;
  /** Kod/iqtibos foni uchun (matn rangi asosida). */
  accentColor?: string;
  onLongPress?: () => void;
  numberOfLines?: number;
}

interface Block {
  kind: 'inline' | 'pre' | 'quote';
  start: number;
  end: number;
  language?: string;
}

function splitBlocks(text: string, entities: readonly TextEntity[]): Block[] {
  const blocks = entities
    .filter((e) => BLOCK_TYPES.has(e.type))
    .sort((a, b) => a.offset - b.offset)
    // Ichma-ich bloklar — faqat tashqisi.
    .filter((e, i, arr) => !arr.slice(0, i).some((p) => p.offset <= e.offset && p.offset + p.length >= e.offset + e.length));
  const out: Block[] = [];
  let pos = 0;
  for (const b of blocks) {
    if (b.offset > pos) out.push({ kind: 'inline', start: pos, end: b.offset });
    out.push({
      kind: b.type === 'Pre' || b.type === 'PreCode' ? 'pre' : 'quote',
      start: b.offset,
      end: b.offset + b.length,
      language: b.language,
    });
    pos = Math.max(pos, b.offset + b.length);
  }
  if (pos < text.length) out.push({ kind: 'inline', start: pos, end: text.length });
  // Bloklar orasidagi bo'sh qator(lar)ni olib tashlash.
  return out
    .map((b) => {
      if (b.kind !== 'inline') return b;
      let { start, end } = b;
      while (start < end && text[start] === '\n' && start > 0) start++;
      while (end > start && text[end - 1] === '\n' && end < text.length) end--;
      return { ...b, start, end };
    })
    .filter((b) => b.end > b.start);
}

function linkAction(e: TextEntity, piece: string, full: string, h: ChatLinkHandlers): (() => void) | undefined {
  const whole = full.slice(e.offset, e.offset + e.length);
  switch (e.type) {
    case 'Url':
      return () => h.openUrl(whole);
    case 'TextUrl':
      return e.url ? () => h.openUrl(e.url!) : undefined;
    case 'Mention':
      return () => h.openMention(whole);
    case 'MentionName':
      return e.userId ? () => h.openUser(e.userId!) : undefined;
    case 'Hashtag':
    case 'Cashtag':
      return h.onHashtag ? () => h.onHashtag!(whole) : undefined;
    case 'BotCommand':
      return h.onBotCommand ? () => h.onBotCommand!(whole) : undefined;
    case 'EmailAddress':
      return () => h.openUrl(`mailto:${whole}`);
    case 'PhoneNumber':
      return () => h.openUrl(`tel:${whole.replace(/[^\d+]/g, '')}`);
    default:
      void piece;
      return undefined;
  }
}

function InlineRange({
  text,
  start,
  end,
  entities,
  style,
  linkColor,
  revealed,
  onReveal,
  onLongPress,
  handlers,
}: {
  text: string;
  start: number;
  end: number;
  entities: readonly TextEntity[];
  style: TextStyle;
  linkColor: string;
  revealed: boolean;
  onReveal: () => void;
  onLongPress?: () => void;
  handlers: ChatLinkHandlers;
}): React.JSX.Element[] {
  const inline = entities.filter((e) => !BLOCK_TYPES.has(e.type) && e.offset < end && e.offset + e.length > start);
  const cuts = new Set<number>([start, end]);
  for (const e of inline) {
    cuts.add(Math.max(start, e.offset));
    cuts.add(Math.min(end, e.offset + e.length));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const out: React.JSX.Element[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    if (b <= a) continue;
    const piece = text.slice(a, b);
    const active = inline.filter((e) => e.offset <= a && e.offset + e.length >= b);
    if (active.length === 0) {
      out.push(<Text key={a}>{piece}</Text>);
      continue;
    }
    const s: TextStyle = {};
    const deco: string[] = [];
    let onPress: (() => void) | undefined;
    let spoiler = false;
    for (const e of active) {
      switch (e.type) {
        case 'Bold':
          s.fontWeight = '700';
          break;
        case 'Italic':
          s.fontStyle = 'italic';
          break;
        case 'Underline':
          deco.push('underline');
          break;
        case 'Strikethrough':
          deco.push('line-through');
          break;
        case 'Code':
          s.fontFamily = MONO;
          s.fontSize = (style.fontSize ?? 16) * 0.92;
          s.color = linkColor;
          break;
        case 'Spoiler':
          spoiler = true;
          break;
        default:
          if (LINK_TYPES.has(e.type)) {
            const act = linkAction(e, piece, text, handlers);
            if (act) {
              onPress = act;
              s.color = linkColor;
              if (e.type === 'TextUrl' || e.type === 'Url') deco.push('underline');
            }
          }
      }
    }
    if (deco.length) {
      s.textDecorationLine = deco.includes('underline') && deco.includes('line-through')
        ? 'underline line-through'
        : (deco[0] as TextStyle['textDecorationLine']);
    }
    if (spoiler && !revealed) {
      out.push(
        <Text
          key={a}
          onPress={onReveal}
          onLongPress={onLongPress}
          style={[s, { color: 'transparent', backgroundColor: `${String(style.color ?? '#888')}55` }]}
        >
          {piece}
        </Text>,
      );
      continue;
    }
    out.push(
      <Text key={a} style={s} onPress={onPress} onLongPress={onPress ? onLongPress : undefined} suppressHighlighting={false}>
        {piece}
      </Text>,
    );
  }
  return out;
}

export default function FormattedText({
  text,
  entities,
  style,
  linkColor,
  accentColor,
  onLongPress,
  numberOfLines,
}: FormattedTextProps): React.JSX.Element {
  const handlers = useChatLinks();
  const [revealed, setRevealed] = useState(false);
  const list = useMemo(() => entities ?? [], [entities]);
  const blocks = useMemo(() => splitBlocks(text, list), [text, list]);
  const accent = accentColor ?? linkColor;

  const renderInline = (start: number, end: number, st: TextStyle) =>
    InlineRange({
      text,
      start,
      end,
      entities: list,
      style: st,
      linkColor,
      revealed,
      onReveal: () => setRevealed(true),
      onLongPress,
      handlers,
    });

  if (blocks.length === 1 && blocks[0]!.kind === 'inline') {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {renderInline(0, text.length, style)}
      </Text>
    );
  }

  return (
    <View>
      {blocks.map((b) => {
        if (b.kind === 'inline') {
          return (
            <Text key={b.start} style={style}>
              {renderInline(b.start, b.end, style)}
            </Text>
          );
        }
        if (b.kind === 'pre') {
          const preStyle: TextStyle = { ...style, fontFamily: MONO, fontSize: (style.fontSize ?? 16) * 0.88 };
          return (
            <View key={b.start} style={[styles.pre, { backgroundColor: `${accent}1F`, borderLeftColor: accent }]}>
              {b.language ? <Text style={[styles.lang, { color: accent }]}>{b.language}</Text> : null}
              <Text style={preStyle} selectable={false}>
                {renderInline(b.start, b.end, preStyle)}
              </Text>
            </View>
          );
        }
        return (
          <View key={b.start} style={[styles.quote, { backgroundColor: `${accent}1A`, borderLeftColor: accent }]}>
            <Text style={style}>{renderInline(b.start, b.end, style)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pre: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginVertical: 3,
  },
  lang: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  quote: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: 3,
  },
});
