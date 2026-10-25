/**
 * Telegram hikoyalari (stories) — TDLib qatlami.
 *
 * - Login'dan keyin `startStories()`: loadActiveStories(storyListMain) —
 *   TDLib natijani updateChatActiveStories orqali yuboradi.
 * - Har bir chat uchun chatActiveStories saqlanadi; order = 0 yoki hikoyasi
 *   yo'q bo'lsa ro'yxatdan olib tashlanadi. Tartib: (order, chat_id) kamayish.
 * - O'zimizning hikoyalar — Saved Messages chati (createPrivateChat(me)).
 * - To'liq hikoya (getStory) keshda; updateStory/updateStoryDeleted bilan yangilanadi.
 * - openStory TDLib'ga hikoya ko'rilayotganini aytadi (shu bilan o'qilgan
 *   deb belgilanadi, max_read_story_id yangilanadi).
 */
import { isGhost } from './ghost';
import { onTdUpdate, td, TdError } from './client';
import { fileUri, onFilesChanged, requestFile } from './files';
import type { TdFile, TdObject } from './types';
import { useStoriesStore, type StoryChat } from '@/stores/stories.store';
import { t } from '@/i18n';

// ---------------------------------------------------------------------------
// TDLib turlari (td_api.tl dan, faqat ishlatiladigan maydonlar)
// ---------------------------------------------------------------------------

interface TdStoryInfo {
  story_id: number;
  date: number;
  is_for_close_friends: boolean;
  is_live: boolean;
}

interface TdChatActiveStories {
  chat_id: number;
  list: { '@type': 'storyListMain' | 'storyListArchive' } | null;
  order: number | string;
  can_be_archived: boolean;
  max_read_story_id: number;
  stories: TdStoryInfo[];
}

export interface TdPhotoSize {
  type: string;
  photo: TdFile;
  width: number;
  height: number;
}

export interface TdMinithumbnail {
  width: number;
  height: number;
  data: string;
}

export interface TdStoryVideo {
  duration: number;
  width: number;
  height: number;
  minithumbnail: TdMinithumbnail | null;
  thumbnail: { file: TdFile; width: number; height: number } | null;
  video: TdFile;
}

export type TdStoryContent =
  | { '@type': 'storyContentPhoto'; photo: { minithumbnail: TdMinithumbnail | null; sizes: TdPhotoSize[] } }
  | { '@type': 'storyContentVideo'; video: TdStoryVideo; alternative_video: TdStoryVideo | null }
  | { '@type': 'storyContentLive'; group_call_id: number; is_rtmp_stream: boolean }
  | { '@type': 'storyContentUnsupported' };

export interface TdStory extends TdObject {
  id: number;
  poster_chat_id: number;
  date: number;
  is_being_posted: boolean;
  can_be_deleted: boolean;
  can_be_replied: boolean;
  interaction_info: { view_count: number; forward_count: number; reaction_count: number } | null;
  chosen_reaction_type: { '@type': string; emoji?: string } | null;
  content: TdStoryContent;
  caption: { text: string } | null;
}

interface TdChatLite extends TdObject {
  id: number;
  title: string;
  photo?: { small: TdFile } | null;
}

// ---------------------------------------------------------------------------
// Holat
// ---------------------------------------------------------------------------

const active = new Map<number, TdChatActiveStories>();
const chatInfo = new Map<number, { title: string; photo?: TdFile }>();
const chatInfoLoading = new Set<number>();
/** Hali yuklanmagan avatar fayllari (file id → fayl). */
const pendingAvatars = new Map<number, TdFile>();
const storyCache = new Map<string, TdStory>();
const storyListeners = new Set<() => void>();
let myChatId = 0;
let offUpdates: (() => void) | null = null;
let offFiles: (() => void) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let session = 0;

const storyKey = (chatId: number, storyId: number) => `${chatId}:${storyId}`;

function notifyStories(): void {
  storyListeners.forEach((fn) => fn());
}

function toStoryChat(a: TdChatActiveStories): StoryChat {
  const info = chatInfo.get(a.chat_id);
  const ids = a.stories.map((s) => s.story_id);
  return {
    chatId: String(a.chat_id),
    name: info?.title ?? '',
    avatarUri: fileUri(info?.photo),
    order: Number(a.order) || 0,
    maxReadId: a.max_read_story_id,
    storyIds: ids,
    hasUnread: ids.some((id) => id > a.max_read_story_id),
  };
}

function flush(): void {
  flushTimer = null;
  const main: StoryChat[] = [];
  let own: StoryChat | null = null;
  active.forEach((a) => {
    if (a.stories.length === 0) return;
    if (a.chat_id === myChatId) {
      own = toStoryChat(a);
      return;
    }
    if (a.list?.['@type'] !== 'storyListMain' || !(Number(a.order) > 0)) return;
    main.push(toStoryChat(a));
  });
  main.sort((x, y) => y.order - x.order || Number(y.chatId) - Number(x.chatId));
  useStoriesStore.setState({ main, own, myChatId: myChatId ? String(myChatId) : null });
}

function scheduleFlush(): void {
  if (!flushTimer) flushTimer = setTimeout(flush, 60);
}

function setChatInfo(chat: TdChatLite): void {
  const photo = chat.photo?.small;
  chatInfo.set(chat.id, { title: chat.title, photo });
  if (photo && !fileUri(photo)) {
    pendingAvatars.set(photo.id, photo);
    requestFile(photo);
  }
}

async function ensureChatInfo(chatId: number): Promise<void> {
  if (chatInfo.has(chatId) || chatInfoLoading.has(chatId)) return;
  chatInfoLoading.add(chatId);
  const chat = await td<TdChatLite>({ '@type': 'getChat', chat_id: chatId }).catch(() => null);
  chatInfoLoading.delete(chatId);
  if (!chat) return;
  setChatInfo(chat);
  scheduleFlush();
}

function handleActive(a: TdChatActiveStories): void {
  if (a.stories.length === 0 && !(Number(a.order) > 0)) active.delete(a.chat_id);
  else active.set(a.chat_id, a);
  void ensureChatInfo(a.chat_id);
  scheduleFlush();
}

function postFailedText(error: { code?: number; message?: string } | null, type: { '@type': string } | null): string {
  switch (type?.['@type']) {
    case 'canPostStoryResultPremiumNeeded':
      return t('stories.err.premiumNeeded');
    case 'canPostStoryResultBoostNeeded':
      return t('stories.err.boostNeeded');
    case 'canPostStoryResultActiveStoryLimitExceeded':
      return t('stories.err.activeLimit');
    case 'canPostStoryResultWeeklyLimitExceeded':
      return t('stories.err.weeklyLimit');
    case 'canPostStoryResultMonthlyLimitExceeded':
      return t('stories.err.monthlyLimit');
    case 'canPostStoryResultLiveStoryIsActive':
      return t('stories.err.liveActive');
    default:
      return error?.message ?? t('stories.postFailed');
  }
}

/** Joylash natijasi haqida UI'ga xabar (StoriesRow alert ko'rsatadi). */
type PostListener = (result: { ok: true } | { ok: false; message: string }) => void;
const postListeners = new Set<PostListener>();

export function onStoryPostResult(fn: PostListener): () => void {
  postListeners.add(fn);
  return () => {
    postListeners.delete(fn);
  };
}

function handleUpdate(update: TdObject): void {
  switch (update['@type']) {
    case 'updateChatActiveStories':
      handleActive(update.active_stories as TdChatActiveStories);
      break;
    case 'updateStory': {
      const story = update.story as TdStory;
      storyCache.set(storyKey(story.poster_chat_id, story.id), story);
      notifyStories();
      break;
    }
    case 'updateStoryDeleted':
      storyCache.delete(storyKey(Number(update.story_poster_chat_id), Number(update.story_id)));
      notifyStories();
      break;
    case 'updateStoryPostSucceeded': {
      const story = update.story as TdStory;
      storyCache.delete(storyKey(story.poster_chat_id, Number(update.old_story_id)));
      storyCache.set(storyKey(story.poster_chat_id, story.id), story);
      useStoriesStore.setState((s) => ({ posting: Math.max(0, s.posting - 1) }));
      postListeners.forEach((fn) => fn({ ok: true }));
      notifyStories();
      break;
    }
    case 'updateStoryPostFailed': {
      const story = update.story as TdStory;
      storyCache.delete(storyKey(story.poster_chat_id, story.id));
      useStoriesStore.setState((s) => ({ posting: Math.max(0, s.posting - 1) }));
      const message = postFailedText(
        update.error as { code?: number; message?: string } | null,
        update.error_type as { '@type': string } | null,
      );
      postListeners.forEach((fn) => fn({ ok: false, message }));
      // Muvaffaqiyatsiz vaqtinchalik hikoya TDLib'da qoladi — o'chirib tashlaymiz.
      void td({ '@type': 'deleteStory', story_poster_chat_id: story.poster_chat_id, story_id: story.id }).catch(
        () => undefined,
      );
      notifyStories();
      break;
    }
    default:
      break;
  }
}

/** Asosiy ro'yxatni oxirigacha yuklaydi (TDLib 404 qaytarguncha). */
async function loadAll(my: number): Promise<void> {
  for (let i = 0; i < 20 && my === session; i++) {
    try {
      await td({ '@type': 'loadActiveStories', story_list: { '@type': 'storyListMain' } });
    } catch {
      break;
    }
  }
}

export function startStories(): void {
  if (offUpdates) return;
  const my = ++session;
  offUpdates = onTdUpdate(handleUpdate);
  offFiles = onFilesChanged(() => {
    // Avatar yuklab bo'lingan bo'lsa ro'yxatni yangilaymiz.
    let changed = false;
    for (const [fileId, file] of pendingAvatars) {
      if (fileUri(file)) {
        pendingAvatars.delete(fileId);
        changed = true;
      }
    }
    if (changed) scheduleFlush();
  });
  void (async () => {
    const me = await td<TdObject & { id: number }>({ '@type': 'getMe' }).catch(() => null);
    if (me && my === session) {
      const chat = await td<TdChatLite>({ '@type': 'createPrivateChat', user_id: me.id, force: false }).catch(
        () => null,
      );
      if (chat && my === session) {
        myChatId = chat.id;
        setChatInfo(chat);
        const own = await td<TdChatActiveStories & TdObject>({
          '@type': 'getChatActiveStories',
          chat_id: chat.id,
        }).catch(() => null);
        if (own && my === session) handleActive(own);
        scheduleFlush();
      }
    }
    await loadAll(my);
  })();
}

export function stopStories(): void {
  session++;
  offUpdates?.();
  offFiles?.();
  offUpdates = null;
  offFiles = null;
  active.clear();
  chatInfo.clear();
  pendingAvatars.clear();
  storyCache.clear();
  myChatId = 0;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  useStoriesStore.setState({ main: [], own: null, myChatId: null, posting: 0 });
}

// ---------------------------------------------------------------------------
// Ko'rish
// ---------------------------------------------------------------------------

/** Store'da bo'lmagan chat uchun faol hikoyalarni so'raydi. */
export async function ensureChatStories(chatIdStr: string): Promise<StoryChat | null> {
  const chatId = Number(chatIdStr);
  const known = active.get(chatId);
  if (known) return toStoryChat(known);
  const a = await td<TdChatActiveStories & TdObject>({ '@type': 'getChatActiveStories', chat_id: chatId }).catch(
    () => null,
  );
  if (!a) return null;
  handleActive(a);
  await ensureChatInfo(chatId);
  return toStoryChat(a);
}

/** Store'dagi yoki keshdagi chat hikoyalari (sinxron). */
export function storyChatOf(chatIdStr: string): StoryChat | null {
  const a = active.get(Number(chatIdStr));
  return a ? toStoryChat(a) : null;
}

export function cachedStory(chatIdStr: string, storyId: number): TdStory | undefined {
  return storyCache.get(storyKey(Number(chatIdStr), storyId));
}

export async function fetchStory(chatIdStr: string, storyId: number): Promise<TdStory> {
  const chatId = Number(chatIdStr);
  const cached = storyCache.get(storyKey(chatId, storyId));
  if (cached) return cached;
  const story = await td<TdStory>({
    '@type': 'getStory',
    story_poster_chat_id: chatId,
    story_id: storyId,
    only_local: false,
  });
  storyCache.set(storyKey(chatId, storyId), story);
  notifyStories();
  return story;
}

export function onStoriesChanged(fn: () => void): () => void {
  storyListeners.add(fn);
  return () => {
    storyListeners.delete(fn);
  };
}

export function openStory(chatIdStr: string, storyId: number): void {
  if (isGhost('stories')) return;
  void td({ '@type': 'openStory', story_poster_chat_id: Number(chatIdStr), story_id: storyId }).catch(() => undefined);
}

export function closeStory(chatIdStr: string, storyId: number): void {
  if (isGhost('stories')) return;
  void td({ '@type': 'closeStory', story_poster_chat_id: Number(chatIdStr), story_id: storyId }).catch(
    () => undefined,
  );
}

/** Yurak reaksiyasini qo'yadi/olib tashlaydi. */
export async function toggleStoryHeart(chatIdStr: string, story: TdStory): Promise<void> {
  const on = story.chosen_reaction_type != null;
  await td({
    '@type': 'setStoryReaction',
    story_poster_chat_id: Number(chatIdStr),
    story_id: story.id,
    reaction_type: on ? null : { '@type': 'reactionTypeEmoji', emoji: '❤️' },
    update_recent_reactions: !on,
  });
  // TDLib updateStory yuboradi; darhol ko'rinishi uchun keshni ham yangilaymiz.
  storyCache.set(storyKey(Number(chatIdStr), story.id), {
    ...story,
    chosen_reaction_type: on ? null : { '@type': 'reactionTypeEmoji', emoji: '❤️' },
  });
  notifyStories();
}

/** Hikoyaga shaxsiy javob (hikoya egasi bilan chatga xabar). */
export async function replyToStory(chatIdStr: string, storyId: number, text: string): Promise<void> {
  await td({
    '@type': 'sendMessage',
    chat_id: Number(chatIdStr),
    topic_id: null,
    reply_to: { '@type': 'inputMessageReplyToStory', story_poster_chat_id: Number(chatIdStr), story_id: storyId },
    options: null,
    reply_markup: null,
    input_message_content: {
      '@type': 'inputMessageText',
      text: { '@type': 'formattedText', text, entities: [] },
      link_preview_options: null,
      clear_draft: false,
    },
  });
}

export async function deleteStory(chatIdStr: string, storyId: number): Promise<void> {
  await td({ '@type': 'deleteStory', story_poster_chat_id: Number(chatIdStr), story_id: storyId });
}

// ---------------------------------------------------------------------------
// Joylash
// ---------------------------------------------------------------------------

export interface StoryMedia {
  kind: 'photo' | 'video';
  /** Lokal yo'l (file:// siz ham bo'ladi). */
  path: string;
  /** Video davomiyligi, soniya. */
  duration?: number;
}

/**
 * O'z nomimizdan hikoya joylaydi (24 soat, hammaga ko'rinadi, profilda saqlanadi).
 * Avval canPostStory bilan tekshiriladi; cheklov bo'lsa tushunarli xato.
 * Natija keyin updateStoryPostSucceeded / updateStoryPostFailed orqali keladi.
 */
export async function postStory(media: StoryMedia): Promise<void> {
  if (!myChatId) throw new Error(t('stories.postFailed'));
  const can = await td<TdObject>({ '@type': 'canPostStory', chat_id: myChatId });
  if (can['@type'] !== 'canPostStoryResultOk') {
    throw new Error(postFailedText(null, can as { '@type': string }));
  }
  const file = { '@type': 'inputFileLocal', path: media.path.replace(/^file:\/\//, '') };
  const content =
    media.kind === 'photo'
      ? { '@type': 'inputStoryContentPhoto', photo: file, added_sticker_file_ids: [] }
      : {
          '@type': 'inputStoryContentVideo',
          video: file,
          added_sticker_file_ids: [],
          duration: media.duration ?? 0,
          cover_frame_timestamp: 0,
          is_animation: false,
        };
  useStoriesStore.setState((s) => ({ posting: s.posting + 1 }));
  try {
    await td({
      '@type': 'postStory',
      chat_id: myChatId,
      content,
      areas: null,
      caption: null,
      privacy_settings: { '@type': 'storyPrivacySettingsEveryone', except_user_ids: [] },
      album_ids: [],
      active_period: 86400,
      from_story_full_id: null,
      is_posted_to_chat_page: true,
      protect_content: false,
    });
  } catch (e) {
    useStoriesStore.setState((s) => ({ posting: Math.max(0, s.posting - 1) }));
    throw e instanceof TdError ? new Error(e.message) : e;
  }
}

/** Bu chat — o'zimizning (Saved Messages) chatmi. */
export function isMyStoryChat(chatIdStr: string): boolean {
  return myChatId !== 0 && Number(chatIdStr) === myChatId;
}
