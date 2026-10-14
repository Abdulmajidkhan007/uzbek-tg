/**
 * Xabar yozish paneli: javob/tahrirlash paneli, biriktirish, matn,
 * yuborish yoki ovozli xabar (bosib turib yozish, chapga surib bekor qilish).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useT } from '@/i18n';
import { useUIStore } from '@/stores/ui.store';
import type { ChatMessage } from '@/stores/chat.store';
import { AppNative, type Recording } from '@/services/native';
import { sendTyping, type OutgoingMedia } from '@/services/tdlib/chats';
import { showAlert } from '@/components/ui/Dialog';
import { openAttachSheet } from './AttachSheet';
import { nameColor } from './chatFormat';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface MessageInputProps {
  chatId: string;
  replyingTo: ChatMessage | null;
  /** Tahrirlanayotgan o'z xabari. */
  editing?: ChatMessage | null;
  placeholder?: string;
  /** Boshlang'ich matn (qoralama). */
  initialText?: string;
  onSendText: (text: string) => void;
  onSendVoice?: (rec: Recording) => void;
  /** Biriktirilgan fayllar; izoh — kiritilgan matn. */
  onSendMedia?: (items: OutgoingMedia[], caption: string) => void;
  onCancelReply: () => void;
  onCancelEdit?: () => void;
  onTextChange?: (text: string) => void;
}

// ---------------------------------------------------------------------------
// Reply / edit bar
// ---------------------------------------------------------------------------
function ContextBar({
  icon,
  title,
  preview,
  color,
  bgColor,
  textSecondary,
  onCancel,
}: {
  icon: string;
  title: string;
  preview: string;
  color: string;
  bgColor: string;
  textSecondary: string;
  onCancel: () => void;
}) {
  const tr = useT();
  return (
    <View style={[barStyles.container, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={20} color={color} style={{ marginRight: 10 }} />
      <View style={[barStyles.accent, { backgroundColor: color }]} />
      <View style={barStyles.textGroup}>
        <Text style={[barStyles.name, { color }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[barStyles.preview, { color: textSecondary }]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <Pressable onPress={onCancel} style={barStyles.cancelButton} accessibilityLabel={tr('chat.cancel')} accessibilityRole="button" hitSlop={8}>
        <Ionicons name="close" size={20} color={textSecondary} />
      </Pressable>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  accent: { width: 2, alignSelf: 'stretch', borderRadius: 1, marginRight: 8 },
  textGroup: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  preview: { fontSize: 14 },
  cancelButton: { padding: 4, marginLeft: 8 },
});

// ---------------------------------------------------------------------------
// Recording UI
// ---------------------------------------------------------------------------
function RecordingBar({
  duration,
  levels,
  slide,
  textColor,
  textSecondary,
  tint,
}: {
  duration: number;
  levels: number[];
  slide: RNAnimated.Value;
  textColor: string;
  textSecondary: string;
  tint: string;
}) {
  const tr = useT();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(0.25, { duration: 600 }), withTiming(1, { duration: 600 })), -1, false);
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const sec = Math.floor(duration);
  const label = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')},${Math.floor((duration % 1) * 10)}`;
  return (
    <View style={recordStyles.container}>
      <Animated.View style={[recordStyles.dot, pulseStyle]} />
      <Text style={[recordStyles.duration, { color: textColor }]}>{label}</Text>
      <View style={recordStyles.levels}>
        {levels.map((v, i) => (
          <View key={i} style={[recordStyles.level, { height: 3 + v * 20, backgroundColor: tint }]} />
        ))}
      </View>
      <RNAnimated.View style={[recordStyles.hintBox, { transform: [{ translateX: slide }] }]}>
        <Ionicons name="chevron-back" size={14} color={textSecondary} />
        <Text style={[recordStyles.hint, { color: textSecondary }]} numberOfLines={1}>
          {tr('chat.voice.slideToCancel')}
        </Text>
      </RNAnimated.View>
    </View>
  );
}

const recordStyles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 40, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5252' },
  duration: { fontSize: 15, fontWeight: '500', minWidth: 52 },
  levels: { flexDirection: 'row', alignItems: 'center', gap: 2, width: 60, overflow: 'hidden' },
  level: { width: 2, borderRadius: 1 },
  hintBox: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 13 },
});

const CANCEL_DX = -110;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MessageInput({
  chatId,
  replyingTo,
  editing,
  placeholder,
  initialText,
  onSendText,
  onSendVoice,
  onSendMedia,
  onCancelReply,
  onCancelEdit,
  onTextChange,
}: MessageInputProps) {
  const theme = useTheme();
  const tr = useT();
  const insets = useSafeAreaInsets();
  const sendWithEnter = useUIStore((s) => s.sendWithEnter);
  const fontSize = useUIStore((s) => s.messageFontSize) || 16;

  const [text, setText] = useState(initialText ?? '');
  const [recording, setRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const hasText = text.trim().length > 0;

  const inputRef = useRef<TextInput>(null);
  const textRef = useRef(text);
  textRef.current = text;

  // Tahrirlash rejimiga kirganda matnni xabar matni bilan to'ldirish.
  const prevEditing = useRef<string | null>(null);
  useEffect(() => {
    const id = editing?.id ?? null;
    if (id === prevEditing.current) return;
    if (editing) {
      setText(editing.text ?? '');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (prevEditing.current) {
      setText('');
    }
    prevEditing.current = id;
  }, [editing]);

  useEffect(() => {
    if (replyingTo) setTimeout(() => inputRef.current?.focus(), 50);
  }, [replyingTo]);

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      onTextChange?.(value);
      if (value.trim().length > 0 && !editing) sendTyping(chatId);
    },
    [chatId, editing, onTextChange],
  );

  const handleSend = useCallback(() => {
    const trimmed = textRef.current.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSendText(trimmed);
    setText('');
    onTextChange?.('');
  }, [onSendText, onTextChange]);

  const handleAttach = useCallback(() => {
    if (!onSendMedia) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openAttachSheet((items) => {
      onSendMedia(items, textRef.current.trim());
      setText('');
      onTextChange?.('');
    });
  }, [onSendMedia, onTextChange]);

  // ----------------------------------------------------------------- ovoz
  const recState = useRef<'idle' | 'starting' | 'recording'>('idle');
  const pendingEnd = useRef<'none' | 'send' | 'cancel'>('none');
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const slide = useRef(new RNAnimated.Value(0)).current;
  const onSendVoiceRef = useRef(onSendVoice);
  onSendVoiceRef.current = onSendVoice;

  const clearTimers = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  };

  const showHint = (s: string) => {
    setHint(s);
    setTimeout(() => setHint(null), 1800);
  };

  const finish = useCallback(async (kind: 'send' | 'cancel') => {
    clearTimers();
    setRecording(false);
    setLevels([]);
    slide.setValue(0);
    recState.current = 'idle';
    const dur = (Date.now() - startedAt.current) / 1000;
    if (kind === 'cancel' || dur < 0.8) {
      AppNative.cancelRecording();
      if (kind === 'send') showHint(tr('chat.voice.holdToRecord'));
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    try {
      const rec = await AppNative.stopRecording();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSendVoiceRef.current?.(rec);
    } catch (e) {
      showAlert(tr('chat.voice.failed'), e instanceof Error ? e.message : String(e));
    }
  }, [slide, tr]);

  const begin = useCallback(async () => {
    if (recState.current !== 'idle') return;
    recState.current = 'starting';
    pendingEnd.current = 'none';
    const has = await AppNative.hasMicPermission().catch(() => false);
    if (!has) {
      recState.current = 'idle';
      const granted = await AppNative.requestMicPermission().catch(() => false);
      if (!granted) showAlert(tr('chat.voice.permission'));
      else showHint(tr('chat.voice.holdToRecord'));
      return;
    }
    const ok = await AppNative.startRecording().catch(() => false);
    if (!ok) {
      recState.current = 'idle';
      showAlert(tr('chat.voice.failed'));
      return;
    }
    recState.current = 'recording';
    startedAt.current = Date.now();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecording(true);
    setRecDuration(0);
    sendTyping(chatId, 'chatActionRecordingVoiceNote');
    timers.current.push(
      setInterval(() => setRecDuration((Date.now() - startedAt.current) / 1000), 100),
      setInterval(() => {
        AppNative.getAmplitude()
          .then((a) => setLevels((prev) => [...prev.slice(-24), Math.max(0, Math.min(1, a))]))
          .catch(() => undefined);
      }, 100),
      setInterval(() => sendTyping(chatId, 'chatActionRecordingVoiceNote'), 4500),
    );
    if (pendingEnd.current !== 'none') void finish(pendingEnd.current);
  }, [chatId, finish, tr]);

  const end = useCallback(
    (kind: 'send' | 'cancel') => {
      if (recState.current === 'recording') void finish(kind);
      else if (recState.current === 'starting') pendingEnd.current = kind;
    },
    [finish],
  );

  const handlers = useRef({ begin, end });
  handlers.current = { begin, end };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => void handlers.current.begin(),
      onPanResponderMove: (_e, g) => {
        if (recState.current !== 'idle') slide.setValue(Math.min(0, g.dx));
        if (g.dx < CANCEL_DX) handlers.current.end('cancel');
      },
      onPanResponderRelease: () => handlers.current.end('send'),
      onPanResponderTerminate: () => handlers.current.end('cancel'),
    }),
  ).current;

  useEffect(
    () => () => {
      clearTimers();
      if (recState.current !== 'idle') AppNative.cancelRecording();
    },
    [],
  );

  // ----------------------------------------------------------------- UI
  const showSend = hasText || !!editing || !onSendVoice;
  const replyName = replyingTo ? replyingTo.senderName || replyingTo.senderPreview.firstName : '';

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: theme.colors.inputBackground,
          paddingBottom: insets.bottom,
          borderTopColor: theme.colors.border,
        },
      ]}
    >
      {editing ? (
        <ContextBar
          icon="pencil"
          title={tr('chat.editing')}
          preview={editing.text ?? ''}
          color={theme.colors.primary}
          bgColor={theme.colors.inputBackground}
          textSecondary={theme.colors.textSecondary}
          onCancel={() => onCancelEdit?.()}
        />
      ) : replyingTo && !recording ? (
        <ContextBar
          icon="arrow-undo"
          title={tr('chat.replyTo', { name: replyName })}
          preview={replyingTo.previewText ?? replyingTo.text ?? ''}
          color={nameColor(replyingTo.senderColorId, theme.isDark, theme.colors.primary)}
          bgColor={theme.colors.inputBackground}
          textSecondary={theme.colors.textSecondary}
          onCancel={onCancelReply}
        />
      ) : null}

      <View style={styles.inputRow}>
        {!recording && onSendMedia && !editing ? (
          <Pressable onPress={handleAttach} style={styles.iconButton} accessibilityLabel={tr('chat.attach')} accessibilityRole="button">
            <Ionicons name="attach" size={26} color={theme.colors.textSecondary} style={{ transform: [{ rotate: '45deg' }] }} />
          </Pressable>
        ) : null}

        {recording ? (
          <RecordingBar
            duration={recDuration}
            levels={levels}
            slide={slide}
            textColor={theme.colors.text}
            textSecondary={theme.colors.textSecondary}
            tint={theme.colors.primary}
          />
        ) : (
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={handleTextChange}
            placeholder={hint ?? placeholder ?? tr('chat.messagePlaceholder')}
            placeholderTextColor={hint ? theme.colors.primary : theme.colors.textTertiary}
            multiline
            maxLength={4096}
            submitBehavior={sendWithEnter ? 'submit' : 'newline'}
            returnKeyType={sendWithEnter ? 'send' : 'default'}
            onSubmitEditing={sendWithEnter ? handleSend : undefined}
            style={[
              styles.textInput,
              {
                color: theme.colors.text,
                fontSize,
                lineHeight: Math.round(fontSize * 1.3),
                maxHeight: Math.round(fontSize * 1.3) * 6 + 20,
              },
            ]}
            accessibilityLabel={placeholder ?? tr('chat.messagePlaceholder')}
          />
        )}

        <View style={styles.actionButtonContainer}>
          {showSend ? (
            <Pressable
              onPress={handleSend}
              disabled={!hasText}
              style={[styles.roundButton, { backgroundColor: hasText ? theme.colors.primary : 'transparent' }]}
              accessibilityLabel={tr('chat.send')}
              accessibilityRole="button"
            >
              <Ionicons
                name={editing ? 'checkmark' : 'send'}
                size={editing ? 24 : 19}
                color={hasText ? '#FFFFFF' : theme.colors.textTertiary}
                style={editing ? undefined : { marginLeft: 3 }}
              />
            </Pressable>
          ) : (
            <View
              {...pan.panHandlers}
              style={[
                styles.roundButton,
                recording && styles.micActive,
                { backgroundColor: recording ? theme.colors.primary : 'transparent' },
              ]}
              accessibilityLabel={tr('chat.recordVoice')}
              accessibilityRole="button"
              accessibilityHint={tr('chat.voice.holdToRecord')}
            >
              <Ionicons name="mic" size={recording ? 28 : 24} color={recording ? '#FFFFFF' : theme.colors.textSecondary} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 6, paddingVertical: 6, gap: 4 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    minHeight: 40,
  },
  actionButtonContainer: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  roundButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  micActive: { width: 64, height: 64, borderRadius: 32, marginTop: -24, marginRight: -12 },
});
