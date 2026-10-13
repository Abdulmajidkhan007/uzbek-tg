import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  DocumentContent,
  PhotoContent,
  StickerContent,
  VideoContent,
  VoiceContent,
} from './MediaContent';
import { format } from 'date-fns';
import { useTheme } from '@/hooks/useTheme';
import { ChatMessage, Reaction } from '@/stores/chat.store';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
  onLongPress?: (message: ChatMessage) => void;
  onReplyPress?: (replyId: string) => void;
  onReactionPress?: (messageId: string, emoji: string) => void;
  /** Rasm/video bosilganda (to'liq ekranda ochish). */
  onMediaPress?: (message: ChatMessage) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

// Parses **bold** and _italic_ segments into typed spans
interface TextSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

function parseFormattedText(raw: string): TextSpan[] {
  const spans: TextSpan[] = [];
  // Match **bold**, _italic_, or plain text
  const regex = /\*\*(.+?)\*\*|_(.+?)_|([^*_]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(raw)) !== null) {
    if (match[1] != null) {
      spans.push({ text: match[1], bold: true, italic: false });
    } else if (match[2] != null) {
      spans.push({ text: match[2], bold: false, italic: true });
    } else if (match[3] != null) {
      spans.push({ text: match[3], bold: false, italic: false });
    }
  }
  return spans;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// Status icon for own messages
function StatusIcon({
  status,
  color,
}: {
  status: ChatMessage['status'];
  color: string;
}) {
  if (status === 'sending') {
    return <Ionicons name="time-outline" size={12} color={color} />;
  }
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={12} color={color} />;
  }
  if (status === 'delivered') {
    return <Ionicons name="checkmark-done" size={12} color={color} />;
  }
  if (status === 'read') {
    return <Ionicons name="checkmark-done" size={12} color="#6BBCFF" />;
  }
  return null;
}

// Voice waveform visualization
function WaveformBars({ waveform }: { waveform: number[] }) {
  const bars = waveform.length > 0 ? waveform : Array(24).fill(0.3);
  return (
    <View style={waveStyles.container}>
      {bars.map((amplitude, i) => (
        <View
          key={i}
          style={[
            waveStyles.bar,
            { height: Math.max(3, amplitude * 24) },
          ]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 2,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
});

// Reply preview block
function ReplyPreview({
  senderName,
  preview,
  primaryColor,
  bubbleColor,
  textColor,
  onPress,
}: {
  senderName: string;
  preview: string;
  primaryColor: string;
  bubbleColor: string;
  textColor: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        replyStyles.container,
        { borderLeftColor: primaryColor, backgroundColor: 'rgba(0,0,0,0.12)' },
      ]}
      accessibilityLabel={`Reply to ${senderName}: ${preview}`}
      accessibilityRole="button"
    >
      <Text style={[replyStyles.name, { color: primaryColor }]} numberOfLines={1}>
        {senderName}
      </Text>
      <Text style={[replyStyles.text, { color: textColor }]} numberOfLines={1}>
        {preview}
      </Text>
    </Pressable>
  );
}

const replyStyles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    paddingLeft: 8,
    paddingVertical: 4,
    marginBottom: 6,
    borderRadius: 4,
  },
  name: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
  },
  text: {
    fontSize: 12,
    opacity: 0.85,
  },
});

// Reaction chips row
function ReactionsRow({
  reactions,
  messageId,
  onReactionPress,
}: {
  reactions: readonly Reaction[];
  messageId: string;
  onReactionPress?: (messageId: string, emoji: string) => void;
}) {
  if (reactions.length === 0) return null;
  return (
    <View style={reactionStyles.row}>
      {reactions.map((r) => (
        <Pressable
          key={r.emoji}
          style={[
            reactionStyles.chip,
            r.hasCurrentUser && reactionStyles.chipActive,
          ]}
          onPress={() => onReactionPress?.(messageId, r.emoji)}
          accessibilityLabel={`${r.emoji} reaction, ${r.count} ${r.count === 1 ? 'person' : 'people'}`}
          accessibilityRole="button"
          accessibilityHint="Tap to add or remove this reaction"
        >
          <Text style={reactionStyles.emoji}>{r.emoji}</Text>
          <Text style={reactionStyles.count}>{r.count}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const reactionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  chipActive: {
    backgroundColor: 'rgba(61,154,232,0.3)',
  },
  emoji: {
    fontSize: 13,
  },
  count: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
const MessageBubble = React.memo(function MessageBubble({
  message,
  isOwn,
  showSender,
  onLongPress,
  onReplyPress,
  onReactionPress,
  onMediaPress,
}: MessageBubbleProps) {
  const theme = useTheme();

  const handleLongPress = useCallback(() => {
    onLongPress?.(message);
  }, [onLongPress, message]);

  const handleReplyPress = useCallback(() => {
    if (message.replyTo) {
      onReplyPress?.(message.replyTo.messageId);
    }
  }, [onReplyPress, message.replyTo]);

  // Deleted state
  if (message.isDeleted) {
    return (
      <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isOwn
                ? theme.colors.messageBubbleOutgoing
                : theme.colors.messageBubbleIncoming,
              borderRadius: theme.radius.lg,
            },
          ]}
        >
          <Text
            style={[
              styles.deletedText,
              { color: theme.colors.textTertiary },
            ]}
          >
            Xabar o'chirilgan
          </Text>
        </View>
      </View>
    );
  }

  // Stiker va dumaloq video-xabar Telegram'dagidek fonsiz chiziladi.
  const bare = message.mediaKind === 'sticker' || message.mediaKind === 'videoNote';
  const bubbleBg = bare
    ? 'transparent'
    : isOwn
    ? theme.colors.messageBubbleOutgoing
    : theme.colors.messageBubbleIncoming;
  const textColor = isOwn
    ? theme.colors.messageBubbleOutgoingText
    : theme.colors.messageBubbleIncomingText;

  // Tail corners: sharpen the corner where the "tail" is
  const bubbleRadius: ViewStyle = isOwn
    ? {
        borderTopLeftRadius: theme.radius.lg,
        borderTopRightRadius: theme.radius.lg,
        borderBottomLeftRadius: theme.radius.lg,
        borderBottomRightRadius: theme.radius.xs,
      }
    : {
        borderTopLeftRadius: theme.radius.lg,
        borderTopRightRadius: theme.radius.lg,
        borderBottomLeftRadius: theme.radius.xs,
        borderBottomRightRadius: theme.radius.lg,
      };

  const statusColor = 'rgba(255,255,255,0.65)';
  const timestampStr = formatTime(message.sentAt);

  // Render message body based on type
  function renderBody() {
    const mediaProps = { message, onPress: onMediaPress, tint: theme.colors.primary, textColor };
    let media: React.ReactNode = null;
    if (message.mediaKind === 'sticker') media = <StickerContent {...mediaProps} />;
    else if (message.type === 'image') media = <PhotoContent {...mediaProps} />;
    else if (message.type === 'video') media = <VideoContent {...mediaProps} />;
    else if (message.type === 'voice' || message.type === 'audio') media = <VoiceContent {...mediaProps} />;
    else if (message.type === 'document') media = <DocumentContent {...mediaProps} />;
    if (media) {
      return (
        <View>
          {media}
          {message.text ? <View style={{ marginTop: 6 }}>{renderText(message.text)}</View> : null}
        </View>
      );
    }

    return renderText(message.text ?? '');
  }

  function renderText(raw: string) {
    const spans = parseFormattedText(raw);

    return (
      <Text style={{ color: textColor, fontSize: theme.fontSizes.md, lineHeight: theme.fontSizes.md * theme.lineHeights.relaxed }}>
        {spans.map((span, i) => {
          const style: TextStyle = {};
          if (span.bold) style.fontWeight = '700';
          if (span.italic) style.fontStyle = 'italic';
          return (
            <Text key={i} style={style}>
              {span.text}
            </Text>
          );
        })}
      </Text>
    );
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <View style={[styles.bubbleGroup, isOwn ? styles.bubbleGroupOwn : styles.bubbleGroupOther]}>
        {/* Sender name (group chats) */}
        {showSender && !isOwn && (
          <Text
            style={[
              styles.senderName,
              { color: theme.colors.primary, marginBottom: theme.spacing.xxs },
            ]}
            numberOfLines={1}
          >
            {message.senderPreview.firstName}
            {message.senderPreview.lastName ? ` ${message.senderPreview.lastName}` : ''}
          </Text>
        )}

        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={350}
          accessibilityLabel={
            message.type === 'voice'
              ? 'Voice message'
              : message.type === 'image'
              ? 'Image message'
              : message.text ?? 'Message'
          }
          accessibilityRole="text"
          accessibilityHint="Long press for options"
        >
          <View style={[styles.bubble, bubbleRadius, { backgroundColor: bubbleBg }]}>
            {/* Reply preview */}
            {message.replyTo != null && (
              <ReplyPreview
                senderName={message.replyTo.senderName}
                preview={message.replyTo.contentPreview}
                primaryColor={theme.colors.primary}
                bubbleColor={bubbleBg}
                textColor={textColor}
                onPress={handleReplyPress}
              />
            )}

            {/* Body */}
            {renderBody()}

            {/* Footer: timestamp + status */}
            <View style={[styles.footer, isOwn ? styles.footerOwn : styles.footerOther]}>
              <Text style={[styles.timestamp, { color: statusColor }]}>
                {timestampStr}
              </Text>
              {message.editedAt != null && (
                <Text style={[styles.edited, { color: statusColor }]}>edited</Text>
              )}
              {isOwn && (
                <View style={styles.statusIcon}>
                  <StatusIcon status={message.status} color={statusColor} />
                </View>
              )}
            </View>
          </View>
        </Pressable>

        {/* Reactions */}
        <ReactionsRow
          reactions={message.reactions}
          messageId={message.id}
          onReactionPress={onReactionPress}
        />
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: 2,
    paddingHorizontal: 8,
  },
  rowOwn: {
    justifyContent: 'flex-end',
  },
  rowOther: {
    justifyContent: 'flex-start',
  },
  bubbleGroup: {
    maxWidth: '80%',
  },
  bubbleGroupOwn: {
    alignItems: 'flex-end',
  },
  bubbleGroupOther: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 13,
    fontWeight: '700',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  deletedText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 3,
  },
  footerOwn: {
    justifyContent: 'flex-end',
  },
  footerOther: {
    justifyContent: 'flex-start',
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.85,
  },
  edited: {
    fontSize: 11,
    opacity: 0.7,
  },
  statusIcon: {
    marginLeft: 1,
  },
  imageThumb: {
    width: 220,
    height: 165,
    borderRadius: 8,
  },
  voiceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 36,
  },
});

export default MessageBubble;
