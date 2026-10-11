import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from '@/utils/haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { ChatMessage } from '@/stores/chat.store';

// ---------------------------------------------------------------------------
// Prop interface
// ---------------------------------------------------------------------------
export interface MessageInputProps {
  chatId: string;
  replyingTo: ChatMessage | null;
  onSendText: (text: string) => void;
  onSendVoice: (uri: string, duration: number, waveform: number[]) => void;
  onAttachmentPress: () => void;
  onCancelReply: () => void;
}

// ---------------------------------------------------------------------------
// Reply preview bar
// ---------------------------------------------------------------------------
function ReplyBar({
  message,
  onCancel,
  primaryColor,
  bgColor,
  textColor,
  textSecondary,
}: {
  message: ChatMessage;
  onCancel: () => void;
  primaryColor: string;
  bgColor: string;
  textColor: string;
  textSecondary: string;
}) {
  const senderName = `${message.senderPreview.firstName}${message.senderPreview.lastName ? ` ${message.senderPreview.lastName}` : ''}`;
  const preview =
    message.type === 'voice'
      ? '🎤 Voice message'
      : message.type === 'image'
      ? '📷 Photo'
      : message.text ?? '';

  return (
    <View style={[replyBarStyles.container, { backgroundColor: bgColor, borderTopColor: primaryColor }]}>
      <View style={[replyBarStyles.accent, { backgroundColor: primaryColor }]} />
      <View style={replyBarStyles.textGroup}>
        <Text style={[replyBarStyles.name, { color: primaryColor }]} numberOfLines={1}>
          {senderName}
        </Text>
        <Text style={[replyBarStyles.preview, { color: textSecondary }]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <Pressable
        onPress={onCancel}
        style={replyBarStyles.cancelButton}
        accessibilityLabel="Cancel reply"
        accessibilityRole="button"
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color={textSecondary} />
      </Pressable>
    </View>
  );
}

const replyBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  accent: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    marginRight: 8,
    minHeight: 32,
  },
  textGroup: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  preview: {
    fontSize: 13,
  },
  cancelButton: {
    padding: 4,
    marginLeft: 8,
  },
});

// ---------------------------------------------------------------------------
// Recording state UI
// ---------------------------------------------------------------------------
function RecordingBar({
  duration,
  onCancel,
  primaryColor,
  textColor,
  textSecondary,
}: {
  duration: number;
  onCancel: () => void;
  primaryColor: string;
  textColor: string;
  textSecondary: string;
}) {
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ),
      -1,
      false,
    );
  }, [pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const durationLabel = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <View style={recordStyles.container}>
      <Animated.View style={[recordStyles.dot, pulseStyle, { backgroundColor: '#FF5252' }]} />
      <Text style={[recordStyles.duration, { color: textColor }]}>{durationLabel}</Text>
      <Text style={[recordStyles.hint, { color: textSecondary }]}>Slide left to cancel</Text>
      <Pressable
        onPress={onCancel}
        style={recordStyles.cancelButton}
        accessibilityLabel="Cancel voice recording"
        accessibilityRole="button"
      >
        <Ionicons name="close-circle" size={24} color="#FF5252" />
      </Pressable>
    </View>
  );
}

const recordStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  duration: {
    fontSize: 15,
    fontWeight: '500',
    minWidth: 44,
  },
  hint: {
    fontSize: 13,
    flex: 1,
  },
  cancelButton: {
    padding: 4,
  },
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MessageInput({
  replyingTo,
  onSendText,
  onSendVoice,
  onAttachmentPress,
  onCancelReply,
}: MessageInputProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasText = text.trim().length > 0;

  // Send-button slide-in animation
  const sendButtonX = useSharedValue(hasText ? 0 : 32);
  const sendButtonOpacity = useSharedValue(hasText ? 1 : 0);
  const micButtonX = useSharedValue(hasText ? 32 : 0);
  const micButtonOpacity = useSharedValue(hasText ? 0 : 1);

  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sendButtonX.value }],
    opacity: sendButtonOpacity.value,
  }));

  const micButtonStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: micButtonX.value }],
    opacity: micButtonOpacity.value,
  }));

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      const nowHasText = value.trim().length > 0;
      if (nowHasText !== hasText) {
        const springConfig = { damping: 18, stiffness: 300 };
        sendButtonX.value = withSpring(nowHasText ? 0 : 32, springConfig);
        sendButtonOpacity.value = withSpring(nowHasText ? 1 : 0, springConfig);
        micButtonX.value = withSpring(nowHasText ? 32 : 0, springConfig);
        micButtonOpacity.value = withSpring(nowHasText ? 0 : 1, springConfig);
      }
    },
    [hasText, sendButtonX, sendButtonOpacity, micButtonX, micButtonOpacity],
  );

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSendText(trimmed);
    setText('');
    // Reset animation values
    sendButtonX.value = withSpring(32, { damping: 18, stiffness: 300 });
    sendButtonOpacity.value = withSpring(0, { damping: 18, stiffness: 300 });
    micButtonX.value = withSpring(0, { damping: 18, stiffness: 300 });
    micButtonOpacity.value = withSpring(1, { damping: 18, stiffness: 300 });
  }, [text, onSendText, sendButtonX, sendButtonOpacity, micButtonX, micButtonOpacity]);

  const startRecording = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecording(true);
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    const duration = recordingDuration;
    setRecordingDuration(0);
    // In a real app the recorded URI would come from a native audio recorder; here we call the
    // callback with a placeholder URI and a flat waveform.
    if (duration > 0) {
      const waveform = Array.from({ length: 32 }, () => Math.random());
      onSendVoice('recording://local', duration, waveform);
    }
  }, [recordingDuration, onSendVoice]);

  const cancelRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const handleAttachmentPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAttachmentPress();
  }, [onAttachmentPress]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const barBg = theme.colors.inputBackground;
  const borderTopColor = theme.colors.border;

  return (
    <View
      style={[
        styles.safeArea,
        {
          backgroundColor: barBg,
          paddingBottom: insets.bottom,
          borderTopColor,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {/* Reply preview */}
      {replyingTo != null && !isRecording && (
        <ReplyBar
          message={replyingTo}
          onCancel={onCancelReply}
          primaryColor={theme.colors.primary}
          bgColor={theme.colors.surfaceElevated}
          textColor={theme.colors.text}
          textSecondary={theme.colors.textSecondary}
        />
      )}

      {/* Main input row */}
      <View style={[styles.inputRow, { backgroundColor: barBg }]}>
        {/* Attach button */}
        {!isRecording && (
          <Pressable
            onPress={handleAttachmentPress}
            style={styles.iconButton}
            accessibilityLabel="Add attachment"
            accessibilityRole="button"
            accessibilityHint="Opens attachment picker"
          >
            <Ionicons
              name="attach"
              size={24}
              color={theme.colors.textSecondary}
              style={{ transform: [{ rotate: '45deg' }] }}
            />
          </Pressable>
        )}

        {/* Text input or recording indicator */}
        {isRecording ? (
          <RecordingBar
            duration={recordingDuration}
            onCancel={cancelRecording}
            primaryColor={theme.colors.primary}
            textColor={theme.colors.text}
            textSecondary={theme.colors.textSecondary}
          />
        ) : (
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message..."
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            maxLength={4000}
            style={[
              styles.textInput,
              {
                color: theme.colors.text,
                fontSize: theme.fontSizes.md,
                maxHeight: theme.fontSizes.md * theme.lineHeights.relaxed * 5 + 24,
              },
            ]}
            returnKeyType="default"
            blurOnSubmit={false}
            accessibilityLabel="Message input"
            accessibilityHint="Type your message here"
          />
        )}

        {/* Send / Mic button */}
        <View style={styles.actionButtonContainer}>
          {/* Mic button (shown when no text) */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.actionButtonInner, micButtonStyle]}
            pointerEvents={hasText || isRecording ? 'none' : 'auto'}
          >
            <Pressable
              onLongPress={startRecording}
              onPressOut={isRecording ? stopRecording : undefined}
              delayLongPress={200}
              style={[styles.roundButton, { backgroundColor: theme.colors.primary }]}
              accessibilityLabel="Record voice message"
              accessibilityRole="button"
              accessibilityHint="Long press to record a voice message"
            >
              <Ionicons name="mic" size={20} color="#FFFFFF" />
            </Pressable>
          </Animated.View>

          {/* Send button (shown when text present) */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.actionButtonInner, sendButtonStyle]}
            pointerEvents={hasText ? 'auto' : 'none'}
          >
            <Pressable
              onPress={handleSend}
              style={[styles.roundButton, { backgroundColor: theme.colors.primary }]}
              accessibilityLabel="Send message"
              accessibilityRole="button"
              accessibilityHint="Sends the typed message"
            >
              <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginLeft: 2 }} />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safeArea: {
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  textInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    minHeight: 40,
    lineHeight: 20,
  },
  actionButtonContainer: {
    width: 40,
    height: 40,
    marginBottom: 2,
  },
  actionButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
