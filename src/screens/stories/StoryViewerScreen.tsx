/**
 * Hikoya ko'ruvchi ekran (to'liq ekran, qora fon).
 *
 * - Tepada: chat hikoyalari soniga teng bo'lakli progress chiziqlari,
 *   avatar + nom + vaqt, yopish (X).
 * - Rasm 5 s ko'rsatiladi; video react-native-video bilan o'ynaydi, progress videoga ergashadi.
 * - O'ngga bosish — keyingi, chapga — oldingi, bosib turish — pauza,
 *   pastga surish — yopish. Oxirgi hikoyadan keyin keyingi chatga, oxirgi chatdan keyin yopiladi.
 * - openStory/closeStory TDLib'ga yuboriladi (openStory hikoyani o'qilgan qiladi).
 * - Pastda: boshqalarniki — shaxsiy javob va yurak reaksiyasi; o'zimizniki —
 *   ko'rishlar soni va o'chirish.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Video, { type VideoRef } from 'react-native-video';
import type { StackScreenProps } from '@react-navigation/stack';

import type { ChatStackParamList } from '@/navigation/types';
import { useT } from '@/i18n';
import { useStoriesStore, type StoryChat } from '@/stores/stories.store';
import { useAuthStore } from '@/stores/auth.store';
import Avatar from '@/components/common/Avatar';
import { showAlert } from '@/components/ui/Dialog';
import { fileUri, onFilesChanged, requestFile } from '@/services/tdlib/files';
import type { TdFile } from '@/services/tdlib/types';
import {
  cachedStory,
  closeStory,
  deleteStory,
  ensureChatStories,
  fetchStory,
  isMyStoryChat,
  onStoriesChanged,
  openStory,
  replyToStory,
  toggleStoryHeart,
  type TdStory,
} from '@/services/tdlib/stories';

type Props = StackScreenProps<ChatStackParamList, 'StoryViewer'>;

const PHOTO_MS = 5500;

// ---------------------------------------------------------------------------
// Yordamchi hook'lar
// ---------------------------------------------------------------------------

/** Chatning faol hikoyalari: store'dan, bo'lmasa getChatActiveStories. */
function useStoryChat(chatId: string | undefined): { chat: StoryChat | null; loaded: boolean } {
  const fromStore = useStoriesStore((s) =>
    !chatId ? null : s.own?.chatId === chatId ? s.own : s.main.find((c) => c.chatId === chatId) ?? null,
  );
  const [fetched, setFetched] = useState<{ id: string; chat: StoryChat | null } | null>(null);
  useEffect(() => {
    if (!chatId || fromStore) return;
    let alive = true;
    void ensureChatStories(chatId).then((c) => {
      if (alive) setFetched({ id: chatId, chat: c });
    });
    return () => {
      alive = false;
    };
  }, [chatId, fromStore]);
  if (fromStore) return { chat: fromStore, loaded: true };
  if (fetched && fetched.id === chatId) return { chat: fetched.chat, loaded: true };
  return { chat: null, loaded: false };
}

/** To'liq hikoya (kesh + getStory), updateStory bilan yangilanadi. */
function useStory(chatId: string | undefined, storyId: number | undefined): { story?: TdStory; error?: string } {
  const [, force] = useState(0);
  const [error, setError] = useState<{ key: string; msg: string } | null>(null);
  const key = `${chatId}:${storyId}`;
  useEffect(() => onStoriesChanged(() => force((n) => n + 1)), []);
  useEffect(() => {
    if (!chatId || storyId == null || cachedStory(chatId, storyId)) return;
    fetchStory(chatId, storyId).catch((e: unknown) =>
      setError({ key, msg: e instanceof Error ? e.message : String(e) }),
    );
  }, [chatId, storyId, key]);
  const story = chatId && storyId != null ? cachedStory(chatId, storyId) : undefined;
  return { story, error: error?.key === key ? error.msg : undefined };
}

/** Faylni yuklab oladi va tayyor bo'lganda lokal URI beradi. */
function useFileUri(file: TdFile | undefined): string | undefined {
  const [, force] = useState(0);
  useEffect(() => {
    if (!file || fileUri(file)) return;
    requestFile(file, 32);
    return onFilesChanged(() => force((n) => n + 1));
  }, [file]);
  return fileUri(file);
}

interface Media {
  kind: 'photo' | 'video' | 'unsupported' | 'live';
  file?: TdFile;
  thumb?: string;
  duration?: number;
}

function mediaOf(story: TdStory | undefined): Media | undefined {
  if (!story) return undefined;
  const c = story.content;
  if (c['@type'] === 'storyContentPhoto') {
    const best = [...c.photo.sizes].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return {
      kind: 'photo',
      file: best?.photo,
      thumb: c.photo.minithumbnail ? `data:image/jpeg;base64,${c.photo.minithumbnail.data}` : undefined,
    };
  }
  if (c['@type'] === 'storyContentVideo') {
    return {
      kind: 'video',
      file: c.video.video,
      thumb: c.video.minithumbnail ? `data:image/jpeg;base64,${c.video.minithumbnail.data}` : undefined,
      duration: c.video.duration,
    };
  }
  if (c['@type'] === 'storyContentLive') return { kind: 'live' };
  return { kind: 'unsupported' };
}

function relTime(tr: ReturnType<typeof useT>, date: number): string {
  const d = Math.max(0, Math.floor(Date.now() / 1000) - date);
  if (d < 60) return tr('stories.justNow');
  if (d < 3600) return tr('stories.minutesAgo', { n: Math.floor(d / 60) });
  return tr('stories.hoursAgo', { n: Math.floor(d / 3600) });
}

// ---------------------------------------------------------------------------
// Progress chiziqlari
// ---------------------------------------------------------------------------

function Segment({ state, progress }: { state: 'done' | 'active' | 'todo'; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({
    width: `${(state === 'done' ? 1 : state === 'todo' ? 0 : Math.min(1, Math.max(0, progress.value))) * 100}%`,
  }));
  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ekran
// ---------------------------------------------------------------------------

type Pos = { chat: number; story: number | 'auto'; storyId?: number };

export function StoryViewerScreen({ navigation, route }: Props): React.JSX.Element {
  const tr = useT();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const me = useAuthStore((s) => s.currentUser);

  // Ko'rish navbati: ochilgan paytdagi asosiy ro'yxat tartibi (o'zimizniki — yolg'iz).
  const [queue] = useState<{ ids: string[]; start: number }>(() => {
    const id = route.params.chatId;
    if (isMyStoryChat(id)) return { ids: [id], start: 0 };
    const ids = useStoriesStore.getState().main.map((c) => c.chatId);
    const i = ids.indexOf(id);
    return i >= 0 ? { ids, start: i } : { ids: [id], start: 0 };
  });
  const [pos, setPos] = useState<Pos>({ chat: queue.start, story: 'auto', storyId: route.params.storyId });
  const chatId = queue.ids[pos.chat];
  const { chat, loaded } = useStoryChat(chatId);
  const ids = useMemo(() => chat?.storyIds ?? [], [chat]);
  const isOwn = chatId ? isMyStoryChat(chatId) : false;

  // 'auto' → aniq indeks: berilgan storyId, aks holda birinchi o'qilmagan.
  useEffect(() => {
    if (pos.story !== 'auto' || !chat) return;
    let idx = pos.storyId != null ? ids.indexOf(pos.storyId) : -1;
    if (idx < 0) idx = ids.findIndex((id) => id > chat.maxReadId);
    setPos({ chat: pos.chat, story: Math.max(0, idx) });
    // faqat chat yuklanganda / chat almashganda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.chat, pos.story, chat != null]);

  const storyIndex = typeof pos.story === 'number' ? Math.min(pos.story, Math.max(0, ids.length - 1)) : -1;
  const storyId = storyIndex >= 0 ? ids[storyIndex] : undefined;
  const { story, error } = useStory(chatId, storyId);
  const media = useMemo(() => mediaOf(story), [story]);
  const uri = useFileUri(media?.file);

  // ---- holatlar
  const [holding, setHolding] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const videoRef = useRef<VideoRef>(null);
  const progress = useSharedValue(0);
  const translateY = useSharedValue(0);

  const staticContent = media?.kind === 'unsupported' || media?.kind === 'live' || (!!error && !story);
  const ready = staticContent || mediaReady;
  const paused = holding || inputFocused || confirmDelete || !ready;

  // ---- navigatsiya
  const close = useCallback(() => navigation.goBack(), [navigation]);

  const goNext = useCallback(() => {
    if (storyIndex >= 0 && storyIndex < ids.length - 1) setPos({ chat: pos.chat, story: storyIndex + 1 });
    else if (pos.chat < queue.ids.length - 1) setPos({ chat: pos.chat + 1, story: 'auto' });
    else close();
  }, [storyIndex, ids.length, pos.chat, queue.ids.length, close]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) setPos({ chat: pos.chat, story: storyIndex - 1 });
    else if (pos.chat > 0) setPos({ chat: pos.chat - 1, story: 'auto' });
    else {
      // Birinchi hikoya: boshidan qayta
      progress.value = 0;
      videoRef.current?.seek(0);
      setNonce((n) => n + 1);
    }
  }, [storyIndex, pos.chat, progress]);

  const nextRef = useRef(goNext);
  nextRef.current = goNext;
  const prevRef = useRef(goPrev);
  prevRef.current = goPrev;
  const callNext = useCallback(() => nextRef.current(), []);

  // Chat yuklandi, lekin faol hikoya yo'q (muddati tugagan / o'chirilgan) — keyingisiga.
  useEffect(() => {
    if (loaded && ids.length === 0) callNext();
  }, [loaded, ids.length, callNext]);

  // ---- hikoya almashganda
  const key = `${chatId}:${storyId}`;
  useEffect(() => {
    progress.value = 0;
    setMediaReady(false);
    setConfirmDelete(false);
  }, [key, progress]);

  // openStory / closeStory
  useEffect(() => {
    if (!chatId || storyId == null) return;
    openStory(chatId, storyId);
    return () => closeStory(chatId, storyId);
  }, [chatId, storyId]);

  // Keyingi hikoyani oldindan yuklash (rasm bo'lsa).
  useEffect(() => {
    if (!ready || !chatId || storyIndex < 0) return;
    const nextId = ids[storyIndex + 1];
    if (nextId == null) return;
    fetchStory(chatId, nextId)
      .then((s) => {
        const m = mediaOf(s);
        if (m?.kind === 'photo') requestFile(m.file, 8);
      })
      .catch(() => undefined);
  }, [ready, chatId, storyIndex, ids]);

  // Rasm taymeri (video progressi onProgress orqali).
  const isVideo = media?.kind === 'video' && !error;
  useEffect(() => {
    if (isVideo || paused) {
      if (!isVideo) cancelAnimation(progress);
      return;
    }
    const remaining = Math.max(50, (1 - progress.value) * PHOTO_MS);
    progress.value = withTiming(1, { duration: remaining, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(callNext)();
    });
    return () => cancelAnimation(progress);
  }, [isVideo, paused, key, nonce, progress, callNext]);

  // ---- imo-ishoralar
  // Bosish: ekranning chap 30% — oldingi, qolgani — keyingi.
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(250)
    .onEnd((e, success) => {
      if (!success) return;
      if (inputFocused) {
        Keyboard.dismiss();
        return;
      }
      if (e.absoluteX < screenW * 0.3) prevRef.current();
      else nextRef.current();
    });

  const longPress = Gesture.LongPress()
    .runOnJS(true)
    .minDuration(220)
    .onStart(() => setHolding(true))
    .onFinalize(() => setHolding(false));

  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetY(14)
    .failOffsetX([-30, 30])
    .onStart(() => setHolding(true))
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        translateY.value = withTiming(screenH, { duration: 160 });
        close();
      } else {
        translateY.value = withTiming(0, { duration: 160 });
      }
    })
    .onFinalize(() => setHolding(false));

  const gesture = Gesture.Race(pan, longPress, tap);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 1 - Math.min(0.5, translateY.value / 800),
  }));

  // ---- amallar
  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((n) => (n === msg ? null : n)), 1800);
  };

  const onSend = () => {
    const body = text.trim();
    if (!body || !chatId || storyId == null) return;
    setText('');
    Keyboard.dismiss();
    replyToStory(chatId, storyId, body)
      .then(() => flash(tr('stories.replySent')))
      .catch((e: unknown) => showAlert(tr('common.error'), e instanceof Error ? e.message : String(e)));
  };

  const onHeart = () => {
    if (!chatId || !story) return;
    toggleStoryHeart(chatId, story).catch((e: unknown) =>
      showAlert(tr('common.error'), e instanceof Error ? e.message : String(e)),
    );
  };

  const onDelete = () => {
    if (!chatId || storyId == null) return;
    setConfirmDelete(false);
    deleteStory(chatId, storyId).catch((e: unknown) =>
      showAlert(tr('common.error'), e instanceof Error ? e.message : String(e)),
    );
  };

  // ---- chizish
  const name = isOwn ? tr('stories.myStory') : chat?.name ?? '';
  const avatarUri = isOwn ? me?.avatarUrl : chat?.avatarUri;
  const caption = story?.caption?.text?.trim();
  const liked = story?.chosen_reaction_type != null;
  const views = story?.interaction_info?.view_count ?? 0;

  let body: React.ReactNode;
  if (!story) {
    body = error ? (
      <Text style={styles.centerText}>{tr('stories.loadFailed')}</Text>
    ) : (
      <ActivityIndicator color="#FFFFFF" size="large" />
    );
  } else if (media?.kind === 'unsupported' || media?.kind === 'live') {
    body = <Text style={styles.centerText}>{tr(media.kind === 'live' ? 'stories.live' : 'stories.unsupported')}</Text>;
  } else {
    body = (
      <>
        {media?.thumb ? (
          <Image source={{ uri: media.thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={12} />
        ) : null}
        {media?.kind === 'photo' && uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            onLoad={() => setMediaReady(true)}
            onError={() => setMediaReady(true)}
          />
        ) : null}
        {media?.kind === 'video' && uri ? (
          <Video
            key={key}
            ref={videoRef}
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
            paused={paused && mediaReady}
            repeat={false}
            progressUpdateInterval={100}
            onLoad={() => setMediaReady(true)}
            onProgress={({ currentTime }) => {
              const d = media.duration || 0;
              if (d > 0) progress.value = currentTime / d;
            }}
            onEnd={callNext}
            onError={() => setMediaReady(true)}
          />
        ) : null}
        {!ready ? <ActivityIndicator color="#FFFFFF" size="large" style={styles.spinner} /> : null}
      </>
    );
  }

  return (
    <Animated.View style={[styles.root, containerStyle]}>
      <StatusBar hidden />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GestureDetector gesture={gesture}>
          <View style={styles.media} collapsable={false}>
            {body}
          </View>
        </GestureDetector>

        {/* Tepa: progress + sarlavha */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.segments}>
            {ids.map((id, i) => (
              <Segment
                key={id}
                progress={progress}
                state={i < storyIndex ? 'done' : i === storyIndex ? 'active' : 'todo'}
              />
            ))}
          </View>
          <View style={styles.header}>
            <Avatar uri={avatarUri} name={(isOwn ? me?.firstName : chat?.name) || '?'} size={36} />
            <View style={styles.headerText}>
              <Text style={styles.headerName} numberOfLines={1}>
                {name}
              </Text>
              {story ? <Text style={styles.headerTime}>{relTime(tr, story.date)}</Text> : null}
            </View>
            <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('stories.close')}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Izoh */}
        {caption ? (
          <View style={styles.captionWrap} pointerEvents="none">
            <Text style={styles.caption} numberOfLines={6}>
              {caption}
            </Text>
          </View>
        ) : null}

        {notice ? (
          <View style={styles.notice} pointerEvents="none">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        {/* Pastki panel */}
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {isOwn ? (
            <View style={styles.ownBar}>
              <Ionicons name="eye-outline" size={20} color="#FFFFFF" />
              <Text style={styles.views}>{views > 0 ? tr.p('stories.views', views) : tr('stories.noViews')}</Text>
              <View style={{ flex: 1 }} />
              {story?.can_be_deleted ? (
                <Pressable
                  onPress={() => setConfirmDelete(true)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={tr('stories.delete')}
                >
                  <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          ) : story ? (
            <View style={styles.replyBar}>
              {story.can_be_replied ? (
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={tr('stories.replyPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  style={styles.input}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  onSubmitEditing={onSend}
                  returnKeyType="send"
                  multiline={false}
                />
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {text.trim() ? (
                <Pressable onPress={onSend} hitSlop={8} style={styles.iconBtn} accessibilityLabel={tr('stories.send')}>
                  <Ionicons name="send" size={24} color="#4FA3E3" />
                </Pressable>
              ) : (
                <Pressable onPress={onHeart} hitSlop={8} style={styles.iconBtn} accessibilityLabel={tr('stories.like')}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? '#FF3B5C' : '#FFFFFF'} />
                </Pressable>
              )}
            </View>
          ) : null}
        </View>

        {confirmDelete ? (
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>{tr('stories.delete')}</Text>
              <Text style={styles.confirmText}>{tr('stories.deleteConfirm')}</Text>
              <View style={styles.confirmButtons}>
                <Pressable onPress={() => setConfirmDelete(false)} style={styles.confirmBtn}>
                  <Text style={styles.confirmCancel}>{tr('common.cancel').toUpperCase()}</Text>
                </Pressable>
                <Pressable onPress={onDelete} style={styles.confirmBtn}>
                  <Text style={styles.confirmDelete}>{tr('common.delete').toUpperCase()}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  media: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  spinner: { position: 'absolute' },
  centerText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', paddingHorizontal: 32 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 8 },
  segments: { flexDirection: 'row', gap: 3 },
  segment: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  segmentFill: { height: '100%', backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 4 },
  headerText: { flex: 1, marginLeft: 10 },
  headerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  },
  headerTime: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, marginTop: 1 },
  captionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 76,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  caption: { color: '#FFFFFF', fontSize: 15, lineHeight: 20 },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  noticeText: { color: '#FFFFFF', fontSize: 14 },
  bottom: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: '#000000' },
  ownBar: { flexDirection: 'row', alignItems: 'center', height: 46, paddingHorizontal: 4 },
  views: { color: '#FFFFFF', fontSize: 15, marginLeft: 8 },
  replyBar: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
  },
  iconBtn: { paddingLeft: 12, paddingVertical: 6 },
  confirmBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: { width: '82%', backgroundColor: '#24303C', borderRadius: 14, padding: 20, paddingBottom: 8 },
  confirmTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginBottom: 10 },
  confirmText: { color: '#B0BEC5', fontSize: 15, lineHeight: 21 },
  confirmButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  confirmBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  confirmCancel: { color: '#4FA3E3', fontSize: 14, fontWeight: '500' },
  confirmDelete: { color: '#FF5252', fontSize: 14, fontWeight: '600' },
});
