/**
 * Xabar pufakchasi (Telegram uslubi): uzatilgan sarlavha, javob bloki,
 * formatlangan matn, media, so'rovnoma/kontakt/joylashuv, havola kartochkasi,
 * imzo + ko'rishlar + vaqt, reaksiyalar, inline tugmalar, kanal izohlari.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { DocumentContent, PhotoContent, StickerContent, VideoContent, VoiceContent } from './MediaContent';
import FormattedText from './FormattedText';
import InlineKeyboard from './InlineKeyboard';
import { BigEmoji, ContactContent, LinkPreviewCard, LocationContent, PollContent } from './SpecialContent';
import { formatCount, nameColor } from './chatFormat';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useUIStore } from '@/stores/ui.store';
import type { ChatMessage, InlineButton, MessageReply, Reaction } from '@/stores/chat.store';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
  /** Kanal posti: imzo, ko'rishlar, izohlar. */
  isChannel?: boolean;
  /** Qidiruv / javobga o'tishda qisqa yoritish. */
  highlighted?: boolean;
  onLongPress?: (message: ChatMessage) => void;
  onReplyPress?: (reply: MessageReply) => void;
  onReactionPress?: (messageId: string, emoji: string) => void;
  /** Rasm/video bosilganda (to'liq ekranda ochish). */
  onMediaPress?: (message: ChatMessage) => void;
  onButtonPress?: (message: ChatMessage, button: InlineButton) => Promise<void> | void;
  onCommentsPress?: (message: ChatMessage) => void;
  onVote?: (message: ChatMessage, optionIds: number[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusIcon({ status, color, readColor }: { status: ChatMessage['status']; color: string; readColor: string }) {
  if (status === 'sending') return <Ionicons name="time-outline" size={12} color={color} />;
  if (status === 'failed') return <Ionicons name="alert-circle" size={13} color="#FF5252" />;
  if (status === 'sent') return <Ionicons name="checkmark" size={13} color={color} />;
  if (status === 'delivered' || status === 'read') {
    return <Ionicons name="checkmark-done" size={14} color={status === 'read' ? readColor : color} />;
  }
  return null;
}

function ReplyPreview({
  reply,
  color,
  textColor,
  onPress,
  onLongPress,
}: {
  reply: MessageReply;
  color: string;
  textColor: string;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[replyStyles.container, { borderLeftColor: color, backgroundColor: `${color}1F` }]}
      accessibilityRole="button"
    >
      {reply.senderName ? (
        <Text style={[replyStyles.name, { color }]} numberOfLines={1}>
          {reply.senderName}
        </Text>
      ) : null}
      <Text style={[replyStyles.text, { color: textColor }]} numberOfLines={reply.quote ? 3 : 1}>
        {reply.quote ? `❝ ${reply.quote}` : reply.contentPreview}
      </Text>
    </Pressable>
  );
}

const replyStyles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 3,
    marginBottom: 5,
    borderRadius: 5,
    minWidth: 120,
  },
  name: { fontSize: 13, fontWeight: '700' },
  text: { fontSize: 13, opacity: 0.9 },
});

function ReactionsRow({
  reactions,
  messageId,
  onReactionPress,
  textColor,
  activeColor,
}: {
  reactions: readonly Reaction[];
  messageId: string;
  onReactionPress?: (messageId: string, emoji: string) => void;
  textColor: string;
  activeColor: string;
}) {
  if (reactions.length === 0) return null;
  return (
    <View style={reactionStyles.row}>
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          style={[
            reactionStyles.chip,
            { backgroundColor: r.hasCurrentUser ? activeColor : `${textColor}1F` },
          ]}
          onPress={() => onReactionPress?.(messageId, r.emoji)}
          accessibilityRole="button"
        >
          <Text style={reactionStyles.emoji}>{r.emoji}</Text>
          <Text style={[reactionStyles.count, { color: r.hasCurrentUser ? '#FFFFFF' : textColor }]}>{formatCount(r.count)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const reactionStyles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 3, gap: 4 },
  emoji: { fontSize: 14 },
  count: { fontSize: 13, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
  showSender,
  isChannel = false,
  highlighted = false,
  onLongPress,
  onReplyPress,
  onReactionPress,
  onMediaPress,
  onButtonPress,
  onCommentsPress,
  onVote,
}: MessageBubbleProps) {
  const theme = useTheme();
  const tr = useT();
  const fontSize = useUIStore((s) => s.messageFontSize) || 16;
  const radiusPref = useUIStore((s) => s.bubbleRadius);
  const radius = radiusPref ?? 17;
  const tail = Math.min(radius, 5);

  const handleLongPress = useCallback(() => onLongPress?.(message), [onLongPress, message]);

  const bare =
    message.mediaKind === 'sticker' ||
    message.mediaKind === 'videoNote' ||
    (!!message.bigEmoji && !message.replyTo && !message.forwardFrom);
  const bubbleBg = bare ? 'transparent' : isOwn ? theme.colors.messageBubbleOutgoing : theme.colors.messageBubbleIncoming;
  const textColor = isOwn ? theme.colors.messageBubbleOutgoingText : theme.colors.messageBubbleIncomingText;
  const metaColor = bare ? '#FFFFFF' : `${textColor}99`;
  const linkColor = isOwn && !theme.isDark ? '#168ACD' : theme.colors.link;
  const timeSize = Math.max(10, Math.round(fontSize * 0.72));
  const senderColor = nameColor(message.senderColorId, theme.isDark, theme.colors.primary);

  if (message.isDeleted) {
    return (
      <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
        <View style={[styles.bubble, { backgroundColor: bubbleBg, borderRadius: radius }]}>
          <Text style={[styles.deletedText, { color: metaColor }]}>{tr('chat.deletedMessage')}</Text>
        </View>
      </View>
    );
  }

  const bubbleRadius: ViewStyle = {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderBottomLeftRadius: isOwn ? radius : tail,
    borderBottomRightRadius: isOwn ? tail : radius,
  };

  const textStyle = { color: textColor, fontSize, lineHeight: Math.round(fontSize * 1.32) };
  const special = { text: textColor, accent: linkColor, fontSize };

  function renderBody() {
    const mediaProps = { message, onPress: onMediaPress, onLongPress: handleLongPress, tint: theme.colors.primary, textColor };
    let media: React.ReactNode = null;
    if (message.mediaKind === 'sticker') media = <StickerContent {...mediaProps} />;
    else if (message.type === 'image') media = <PhotoContent {...mediaProps} />;
    else if (message.type === 'video') media = <VideoContent {...mediaProps} />;
    else if (message.type === 'voice' || message.type === 'audio') media = <VoiceContent {...mediaProps} />;
    else if (message.type === 'document') media = <DocumentContent {...mediaProps} />;
    else if (message.poll)
      media = <PollContent poll={message.poll} colors={special} onVote={onVote ? (ids) => onVote(message, ids) : undefined} />;
    else if (message.contact) media = <ContactContent contact={message.contact} colors={special} />;
    else if (message.location) media = <LocationContent location={message.location} colors={special} />;
    else if (message.bigEmoji) media = <BigEmoji emoji={message.bigEmoji} />;

    const text = message.text ? (
      <FormattedText
        text={message.text}
        entities={message.entities}
        style={textStyle}
        linkColor={linkColor}
        onLongPress={handleLongPress}
      />
    ) : null;
    return (
      <View>
        {media}
        {text ? <View style={media ? { marginTop: 6 } : undefined}>{text}</View> : null}
        {message.linkPreview ? <LinkPreviewCard preview={message.linkPreview} colors={special} /> : null}
      </View>
    );
  }

  const footer = (
    <View style={[styles.footer, bare && styles.footerBare]}>
      {message.authorSignature && isChannel ? (
        <Text style={[styles.meta, { color: metaColor, fontSize: timeSize }]} numberOfLines={1}>
          {message.authorSignature},
        </Text>
      ) : null}
      {message.viewCount ? (
        <>
          <Ionicons name="eye-outline" size={timeSize + 2} color={metaColor} />
          <Text style={[styles.meta, { color: metaColor, fontSize: timeSize, marginRight: 4 }]}>{formatCount(message.viewCount)}</Text>
        </>
      ) : null}
      {message.isPinned ? <Ionicons name="pin" size={timeSize} color={metaColor} /> : null}
      {message.isEdited ? <Text style={[styles.meta, { color: metaColor, fontSize: timeSize }]}>{tr('chat.edited')}</Text> : null}
      <Text style={[styles.meta, { color: metaColor, fontSize: timeSize }]}>{format(message.sentAt, 'HH:mm')}</Text>
      {isOwn ? (
        <View style={styles.statusIcon}>
          <StatusIcon status={message.status} color={metaColor} readColor={bare ? '#FFFFFF' : theme.isDark ? '#6BBCFF' : '#4FAE4E'} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther, highlighted && styles.highlight]}>
      <View style={[styles.bubbleGroup, isOwn ? styles.bubbleGroupOwn : styles.bubbleGroupOther]}>
        <Pressable onLongPress={handleLongPress} delayLongPress={350} accessibilityHint={tr('chat.moreOptions')}>
          <View style={[styles.bubble, bubbleRadius, { backgroundColor: bubbleBg }, bare && styles.bubbleBare]}>
            {message.forwardFrom ? (
              <Text style={[styles.forward, { color: linkColor }]} numberOfLines={2}>
                {tr('chat.forwardedFrom', { name: message.forwardFrom })}
              </Text>
            ) : null}

            {showSender && !isOwn && !bare ? (
              <Text style={[styles.senderName, { color: senderColor }]} numberOfLines={1}>
                {message.senderName || message.senderPreview.firstName}
              </Text>
            ) : null}

            {message.replyTo != null ? (
              <ReplyPreview
                reply={message.replyTo}
                color={nameColor(message.replyTo.colorId, theme.isDark, linkColor)}
                textColor={textColor}
                onPress={() => onReplyPress?.(message.replyTo!)}
                onLongPress={handleLongPress}
              />
            ) : null}

            {renderBody()}

            {footer}

            {message.hasComments && onCommentsPress ? (
              <Pressable
                onPress={() => onCommentsPress(message)}
                onLongPress={handleLongPress}
                style={[styles.comments, { borderTopColor: `${textColor}22` }]}
                accessibilityRole="button"
              >
                <Ionicons name="chatbubbles-outline" size={18} color={linkColor} />
                <Text style={[styles.commentsText, { color: linkColor }]}>
                  {message.replyCount ? tr.p('chat.comments', message.replyCount) : tr('chat.leaveComment')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={linkColor} />
              </Pressable>
            ) : null}
          </View>
        </Pressable>

        <ReactionsRow
          reactions={message.reactions}
          messageId={message.id}
          onReactionPress={onReactionPress}
          textColor={bare || !theme.isDark ? theme.colors.text : textColor}
          activeColor={theme.colors.primary}
        />

        {message.replyMarkup && message.replyMarkup.length > 0 && onButtonPress ? (
          <InlineKeyboard rows={message.replyMarkup} onPress={(b) => onButtonPress(message, b)} isDark={theme.isDark} />
        ) : null}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 2, paddingHorizontal: 8 },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  highlight: { backgroundColor: 'rgba(80,160,230,0.22)' },
  bubbleGroup: { maxWidth: '82%' },
  bubbleGroupOwn: { alignItems: 'flex-end' },
  bubbleGroupOther: { alignItems: 'flex-start' },
  senderName: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  forward: { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  bubble: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 5, minWidth: 64 },
  bubbleBare: { paddingHorizontal: 0 },
  deletedText: { fontSize: 14, fontStyle: 'italic' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, gap: 3, alignSelf: 'flex-end' },
  footerBare: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  meta: { opacity: 0.95 },
  statusIcon: { marginLeft: 1 },
  comments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 6,
    paddingTop: 7,
    paddingBottom: 2,
  },
  commentsText: { flex: 1, fontSize: 14, fontWeight: '600' },
});

export default MessageBubble;
