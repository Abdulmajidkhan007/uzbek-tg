/**
 * Xabar ichidagi media: rasm, video/GIF/video-xabar, stiker, ovozli xabar,
 * audio va fayl. Fayllar TDLib orqali kerak bo'lganda (yoki avto-yuklash
 * qoidasiga ko'ra) yuklab olinadi.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import type { ChatMessage } from '@/stores/chat.store';
import { cancelDownload, downloadFileNow, requestFileById } from '@/services/tdlib/files';
import { AppNative } from '@/services/native';
import { showAlert } from '@/components/ui/Dialog';
import { useT } from '@/i18n';

const MAX_W = 260;
const MAX_H = 320;
const MIN_W = 140;

export function formatDuration(sec: number | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fitSize(w: number | undefined, h: number | undefined, max = MAX_W): { width: number; height: number } {
  if (!w || !h) return { width: max, height: Math.round(max * 0.75) };
  let width = Math.min(max, Math.max(MIN_W, w));
  let height = (width * h) / w;
  if (height > MAX_H) {
    height = MAX_H;
    width = Math.max(MIN_W, (MAX_H * w) / h);
  }
  return { width: Math.round(width), height: Math.round(height) };
}

interface MediaProps {
  message: ChatMessage;
  onPress?: (message: ChatMessage) => void;
  onLongPress?: () => void;
  tint: string;
  textColor: string;
}

/** Yuklash/yuborish jarayoni: doira ichida foiz. */
function ProgressBadge({ value, onCancel }: { value: number; onCancel?: () => void }): React.JSX.Element {
  return (
    <Pressable onPress={onCancel} disabled={!onCancel} style={styles.progressCircle}>
      <ActivityIndicator color="#FFFFFF" size="small" style={StyleSheet.absoluteFill} />
      <Text style={styles.progressText}>{Math.round(value * 100)}%</Text>
    </Pressable>
  );
}

/** Rasm: xira oldindan ko'rinish; avto-yuklanmagan bo'lsa yuklab olish tugmasi. */
export function PhotoContent({ message, onPress, onLongPress }: MediaProps): React.JSX.Element {
  const size = fitSize(message.mediaWidth, message.mediaHeight);
  const uri = message.mediaUrl ?? message.thumbUrl;
  const loading = !message.mediaUrl && !message.needsDownload;
  return (
    <Pressable
      onPress={() => {
        if (message.needsDownload && message.mediaFileId) requestFileById(message.mediaFileId);
        else onPress?.(message);
      }}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="imagebutton"
    >
      <View style={[styles.mediaBox, size]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={message.mediaUrl ? 0 : 8} />
        ) : null}
        {message.uploadProgress != null ? (
          <ProgressBadge value={message.uploadProgress} />
        ) : message.needsDownload ? (
          <View style={styles.playCircle}>
            <Ionicons name="arrow-down" size={26} color="#FFFFFF" />
          </View>
        ) : loading ? (
          message.downloadProgress != null ? (
            <ProgressBadge
              value={message.downloadProgress}
              onCancel={message.mediaFileId ? () => cancelDownload(message.mediaFileId!) : undefined}
            />
          ) : (
            <ActivityIndicator color="#FFFFFF" />
          )
        ) : null}
        {message.needsDownload && message.fileSize ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatSize(message.fileSize)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Video, GIF va dumaloq video-xabar: oldindan ko'rinish + ijro tugmasi. */
export function VideoContent({ message, onPress, onLongPress }: MediaProps): React.JSX.Element {
  const isNote = message.mediaKind === 'videoNote';
  const size = isNote ? { width: 200, height: 200 } : fitSize(message.mediaWidth, message.mediaHeight);
  const progress = message.uploadProgress ?? message.downloadProgress;
  return (
    <Pressable onPress={() => onPress?.(message)} onLongPress={onLongPress} delayLongPress={350} accessibilityRole="button">
      <View style={[styles.mediaBox, size, isNote && { borderRadius: 100 }]}>
        {message.thumbUrl ? (
          <Image source={{ uri: message.thumbUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        {progress != null ? (
          <ProgressBadge value={progress} />
        ) : (
          <View style={styles.playCircle}>
            <Ionicons name="play" size={26} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {message.mediaKind === 'gif' ? 'GIF' : formatDuration(message.duration)}
            {message.mediaKind === 'video' && message.fileSize && !message.mediaLocalPath ? `  ${formatSize(message.fileSize)}` : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function StickerContent({ message, onLongPress }: MediaProps): React.JSX.Element {
  const size = fitSize(message.mediaWidth, message.mediaHeight, 170);
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={350}>
      {message.mediaUrl ? (
        <Image source={{ uri: message.mediaUrl }} style={{ width: size.width, height: size.width }} resizeMode="contain" />
      ) : (
        <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      )}
    </Pressable>
  );
}

// Bir vaqtda faqat bitta ovozli xabar ijro etiladi.
let stopActive: (() => void) | null = null;

/** Ovozli xabar va audio: bosilganda yuklab olib ijro etadi. */
export function VoiceContent({ message, tint, textColor, onLongPress }: MediaProps): React.JSX.Element {
  const [uri, setUri] = useState<string | null>(message.mediaLocalPath ? `file://${message.mediaLocalPath}` : null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const stopRef = useRef<() => void>(() => setPlaying(false));

  useEffect(
    () => () => {
      if (stopActive === stopRef.current) stopActive = null;
    },
    [],
  );

  const toggle = useCallback(async () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (stopActive && stopActive !== stopRef.current) stopActive();
    stopActive = stopRef.current;
    let local = uri;
    if (!local) {
      if (!message.mediaFileId) return;
      setLoading(true);
      local = await downloadFileNow(message.mediaFileId).catch(() => null);
      setLoading(false);
      if (!local) return;
      setUri(local);
    }
    setPlaying(true);
  }, [playing, uri, message.mediaFileId]);

  const total = message.duration ?? 0;
  const progress = total > 0 ? position / total : 0;
  const bars = message.waveform && message.waveform.length > 0 ? message.waveform : Array(30).fill(0.25);
  const step = Math.max(1, Math.floor(bars.length / 34));
  const shown = bars.filter((_, i) => i % step === 0).slice(0, 34);

  return (
    <View style={styles.voiceRow}>
      <Pressable
        onPress={toggle}
        onLongPress={onLongPress}
        style={[styles.voiceButton, { backgroundColor: tint }]}
        accessibilityRole="button"
      >
        {loading || message.uploadProgress != null ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#FFFFFF" style={!playing && { marginLeft: 2 }} />
        )}
      </Pressable>
      <View style={{ flex: 1 }}>
        {message.type === 'audio' ? (
          <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>
            {message.fileName}
          </Text>
        ) : (
          <View style={styles.waveform}>
            {shown.map((v, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: 4 + v * 18,
                    backgroundColor: i / shown.length <= progress && progress > 0 ? tint : `${textColor}55`,
                  },
                ]}
              />
            ))}
          </View>
        )}
        <Text style={[styles.voiceTime, { color: `${textColor}AA` }]}>
          {playing || position > 0 ? formatDuration(position) : formatDuration(total)}
        </Text>
      </View>
      {uri ? (
        <Video
          source={{ uri }}
          paused={!playing}
          playInBackground={false}
          onProgress={(p) => setPosition(p.currentTime)}
          onEnd={() => {
            setPlaying(false);
            setPosition(0);
          }}
          style={styles.hiddenPlayer}
        />
      ) : null}
    </View>
  );
}

/** Lokal faylni tashqi ilovada ochadi. */
export async function openLocalFile(path: string, mime: string): Promise<void> {
  const ok = await AppNative.openFile(path.replace(/^file:\/\//, ''), mime).catch(() => false);
  if (!ok) {
    const { t } = await import('@/i18n');
    showAlert(t('chat.cantOpenFile'));
  }
}

/** Fayl: nomi, hajmi; bosilganda yuklab olinadi, yuklangan bo'lsa ochiladi. */
export function DocumentContent({ message, tint, textColor, onLongPress }: MediaProps): React.JSX.Element {
  const tr = useT();
  const [loading, setLoading] = useState(false);
  const localPath = message.mediaLocalPath;
  const progress = message.uploadProgress ?? message.downloadProgress;

  const press = useCallback(async () => {
    if (localPath) {
      await openLocalFile(localPath, message.mimeType ?? '*/*');
      return;
    }
    if (!message.mediaFileId) return;
    if (message.downloadProgress != null) {
      cancelDownload(message.mediaFileId);
      return;
    }
    setLoading(true);
    requestFileById(message.mediaFileId);
    setLoading(false);
  }, [localPath, message.mediaFileId, message.mimeType, message.downloadProgress]);

  return (
    <Pressable onPress={press} onLongPress={onLongPress} delayLongPress={350} style={styles.voiceRow} accessibilityRole="button">
      <View style={[styles.voiceButton, { backgroundColor: tint }]}>
        {progress != null || loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Ionicons name={localPath ? 'document-text' : 'arrow-down'} size={20} color="#FFFFFF" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.fileName, { color: textColor }]} numberOfLines={2}>
          {message.fileName}
        </Text>
        <Text style={[styles.voiceTime, { color: `${textColor}AA` }]}>
          {progress != null
            ? `${formatSize(Math.round((message.fileSize ?? 0) * progress))} / ${formatSize(message.fileSize)}`
            : localPath
            ? `${formatSize(message.fileSize)} · ${tr('chat.openFile')}`
            : formatSize(message.fileSize)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mediaBox: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  badge: {
    position: 'absolute',
    left: 8,
    top: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', minWidth: 220, paddingVertical: 2 },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  waveform: { flexDirection: 'row', alignItems: 'flex-end', height: 24, gap: 2 },
  waveBar: { width: 3, borderRadius: 2 },
  voiceTime: { fontSize: 12, marginTop: 3 },
  fileName: { fontSize: 15, fontWeight: '500' },
  hiddenPlayer: { width: 0, height: 0 },
});
