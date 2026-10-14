/**
 * Chatlar va xabarlar sinxronizatsiyasi: TDLib update'laridan lokal kesh
 * (chat/user obyektlari) yig'iladi va UI uchun useChatStore'ga yoziladi.
 *
 * Ghost mode (3-faza) uchun: o'qilgan belgisi faqat `markRead` orqali,
 * "yozmoqda" holati faqat `sendTyping` orqali yuboriladi — boshqa joyda
 * viewMessages / sendChatAction chaqirilmaydi.
 */
import {
  useChatStore,
  type Chat,
  type ChatMessage,
  type InlineButton,
  type InlineButtonKind,
  type MessageReply,
  type PollInfo,
  type TextEntity,
  type UserPreview,
} from '@/stores/chat.store';
import { t, tp } from '@/i18n';
import { shouldAutoDownload } from '@/services/autoDownload';
import { onTdUpdate, td } from './client';
import {
  downloadProgressOf,
  filePath,
  fileUri,
  isFileRequested,
  onFilesChanged,
  requestFile,
  uploadProgressOf,
} from './files';
import type {
  TdChat,
  TdFormattedText,
  TdMessage,
  TdMessageContent,
  TdMessageOrigin,
  TdObject,
  TdSupergroup,
  TdUser,
} from './types';

const chats = new Map<number, TdChat>();
const users = new Map<number, TdUser>();
const supergroups = new Map<number, TdSupergroup>();
const basicGroupStatus = new Map<number, string>();
/** Ochilgan chatlarning xabarlari (eskidan yangiga). */
const history = new Map<number, TdMessage[]>();
/** Guruh/kanal a'zolari soni: basic_group_id / supergroup_id bo'yicha. */
const basicGroupCounts = new Map<number, number>();
const supergroupCounts = new Map<number, number>();
/** Javob berilgan / qadalgan xabarlar keshi: `${chatId}:${messageId}` → xabar (null — topilmadi). */
const extraMessages = new Map<string, TdMessage | null>();
const pendingExtra = new Set<string>();
const pendingUsers = new Set<number>();
const pendingChats = new Set<number>();
/** Oxirgi UI modeli (o'zgarmagan xabarlar obyekti qayta ishlatiladi — React.memo ishlashi uchun). */
const lastUi = new Map<number, Map<string, ChatMessage>>();
let myUserId = 0;

let unsubscribe: (() => void) | null = null;
let unsubscribeFiles: (() => void) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const dirtyHistory = new Set<number>();

// ---------------------------------------------------------------------------
// TDLib → UI modeli
// ---------------------------------------------------------------------------

type TdChatList = { '@type': string; chat_folder_id?: number };
type AnyRec = Record<string, any>;

/** Ro'yxat kaliti: 'main' | 'archive' | 'folder:<id>'. */
export function listKey(list: TdChatList): string {
  if (list['@type'] === 'chatListArchive') return 'archive';
  if (list['@type'] === 'chatListFolder') return `folder:${list.chat_folder_id}`;
  return 'main';
}

function tdList(key: string): TdChatList {
  if (key === 'archive') return { '@type': 'chatListArchive' };
  if (key.startsWith('folder:')) return { '@type': 'chatListFolder', chat_folder_id: Number(key.slice(7)) };
  return { '@type': 'chatListMain' };
}

function positionIn(chat: TdChat, key: string) {
  return chat.positions.find((p) => listKey(p.list as TdChatList) === key);
}

function mainPosition(chat: TdChat) {
  return positionIn(chat, 'main');
}

/** int64 satrlarni taqqoslash (order) — BigInt'siz: avval uzunlik, keyin leksik. */
function compareOrderDesc(a: string, b: string): number {
  if (a.length !== b.length) return b.length - a.length;
  return a < b ? 1 : a > b ? -1 : 0;
}

function userName(u: TdUser | undefined): string {
  if (!u) return '';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || t('chat.deletedAccount');
}

/** Foydalanuvchi keshda bo'lmasa — so'rab oladi (keyin tarix qayta chiziladi). */
function ensureUser(id: number): TdUser | undefined {
  const u = users.get(id);
  if (u || !id || pendingUsers.has(id)) return u;
  pendingUsers.add(id);
  td<TdUser & TdObject>({ '@type': 'getUser', user_id: id })
    .then((user) => {
      users.set(user.id, user);
      history.forEach((_, chatId) => dirtyHistory.add(chatId));
      scheduleFlush();
    })
    .catch(() => undefined)
    .finally(() => pendingUsers.delete(id));
  return undefined;
}

function ensureChat(id: number): TdChat | undefined {
  const c = chats.get(id);
  if (c || !id || pendingChats.has(id)) return c;
  pendingChats.add(id);
  td<TdChat & TdObject>({ '@type': 'getChat', chat_id: id })
    .then((chat) => {
      if (!chats.has(chat.id)) chats.set(chat.id, chat);
      history.forEach((_, chatId) => dirtyHistory.add(chatId));
      scheduleFlush();
    })
    .catch(() => undefined)
    .finally(() => pendingChats.delete(id));
  return undefined;
}

function nameOfUserId(id: number): string {
  if (id === myUserId) return t('chat.you');
  return userName(ensureUser(id));
}

function colorOf(accent: number | undefined, id: number): number {
  return accent != null && accent >= 0 && accent < 7 ? accent : Math.abs(id) % 7;
}

function userStatus(u: TdUser | undefined): UserPreview['status'] {
  switch (u?.status['@type']) {
    case 'userStatusOnline':
      return 'online';
    case 'userStatusRecently':
      return 'recently';
    case 'userStatusOffline':
      return 'last_seen';
    default:
      return 'offline';
  }
}

function userPreview(u: TdUser | undefined, fallbackId: string): UserPreview {
  const st = u?.status as ({ '@type': string; was_online?: number } | undefined);
  return {
    id: u ? String(u.id) : fallbackId,
    firstName: u?.first_name || userName(u) || '',
    lastName: u?.last_name || undefined,
    username: u?.usernames?.active_usernames[0],
    avatarUrl: fileUri(u?.profile_photo?.small),
    status: userStatus(u),
    isVerified: false,
    wasOnline: st?.was_online,
    statusDetail:
      st?.['@type'] === 'userStatusLastWeek'
        ? 'lastWeek'
        : st?.['@type'] === 'userStatusLastMonth'
        ? 'lastMonth'
        : st?.['@type'] === 'userStatusEmpty'
        ? 'longAgo'
        : undefined,
    isBot: u?.type['@type'] === 'userTypeBot',
    colorId: u ? colorOf(u.accent_color_id, u.id) : undefined,
  };
}

function captionOf(c: TdMessageContent): string {
  const cap = (c as AnyRec).caption as TdFormattedText | undefined;
  return cap?.text ? ` ${cap.text}` : '';
}

/** Matnsiz xabar turlari uchun qisqa yozuv (ro'yxat, javob, qadalgan xabar). */
function contentPreview(m: TdMessage): string {
  const c = m.content as unknown as AnyRec;
  const caption = captionOf(m.content);
  switch (c['@type']) {
    case 'messageText':
      return c.text?.text ?? '';
    case 'messagePhoto':
      return `📷 ${t('chat.preview.photo')}${caption}`;
    case 'messageVideo':
      return `🎬 ${t('chat.preview.video')}${caption}`;
    case 'messageAnimation':
      return `GIF${caption}`;
    case 'messageVoiceNote':
      return `🎤 ${t('chat.preview.voice')}`;
    case 'messageVideoNote':
      return `⏺ ${t('chat.preview.videoMessage')}`;
    case 'messageAudio':
      return `🎵 ${c.audio?.title || c.audio?.file_name || t('chat.preview.audio')}`;
    case 'messageDocument':
      return `📎 ${c.document?.file_name || t('chat.preview.file')}${caption}`;
    case 'messageSticker':
      return `${c.sticker?.emoji ?? ''} ${t('chat.preview.sticker')}`.trim();
    case 'messageAnimatedEmoji':
    case 'messageDice':
      return c.emoji ?? '';
    case 'messageContact':
      return `👤 ${t('chat.preview.contact')}`;
    case 'messageLocation':
    case 'messageLiveLocation':
      return `📍 ${t('chat.preview.location')}`;
    case 'messageVenue':
      return `📍 ${c.venue?.title || t('chat.preview.location')}`;
    case 'messagePoll':
      return `📊 ${c.poll?.question?.text || t('chat.preview.poll')}`;
    case 'messageGame':
      return `🎮 ${c.game?.title || t('chat.preview.game')}`;
    case 'messageStory':
      return t('chat.preview.story');
    case 'messageInvoice':
      return `🧾 ${c.product_info?.title || t('chat.preview.invoice')}`;
    case 'messageChecklist':
      return `☑️ ${c.list?.title?.text || t('chat.preview.checklist')}`;
    case 'messagePaidMedia':
      return `⭐ ${t('chat.preview.paidMedia')}${caption}`;
    case 'messageGiveaway':
      return `🎁 ${t('chat.preview.giveaway')}`;
    case 'messageUnsupported':
      return t('chat.unsupported');
    default:
      return serviceText(m) ?? t('chat.service.generic');
  }
}

/** Oddiy (bubble'da ko'rsatiladigan) kontent turlari — qolganlari xizmat xabari. */
const REGULAR_CONTENT = new Set([
  'messageText',
  'messageRichMessage',
  'messageAnimation',
  'messageAudio',
  'messageDocument',
  'messagePaidMedia',
  'messagePhoto',
  'messageSticker',
  'messageVideo',
  'messageVideoNote',
  'messageVoiceNote',
  'messageLiveLocation',
  'messageLocation',
  'messageVenue',
  'messageContact',
  'messageAnimatedEmoji',
  'messageDice',
  'messageGame',
  'messagePoll',
  'messageStakeDice',
  'messageStory',
  'messageChecklist',
  'messageInvoice',
  'messageGiveaway',
  'messageUnsupported',
]);

function senderNameOf(m: TdMessage): string {
  if (m.sender_id['@type'] === 'messageSenderUser' && m.sender_id.user_id) {
    if (m.is_outgoing || m.sender_id.user_id === myUserId) return t('chat.you');
    return userName(ensureUser(m.sender_id.user_id));
  }
  const id = m.sender_id.chat_id ?? m.chat_id;
  return ensureChat(id)?.title ?? '';
}

function formatPeriod(sec: number): string {
  if (sec >= 86400 * 30 && sec % (86400 * 30) === 0) return tp('chat.period.months', sec / (86400 * 30));
  if (sec >= 86400 * 7 && sec % (86400 * 7) === 0) return tp('chat.period.weeks', sec / (86400 * 7));
  if (sec >= 86400) return tp('chat.period.days', Math.round(sec / 86400));
  if (sec >= 3600) return tp('chat.period.hours', Math.round(sec / 3600));
  if (sec >= 60) return tp('chat.period.minutes', Math.round(sec / 60));
  return tp('chat.period.seconds', sec);
}

function formatCallDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

function shortQuote(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > 40 ? `${one.slice(0, 40)}…` : one;
}

/** Xizmat xabari matni (oddiy xabar bo'lsa undefined). */
function serviceText(m: TdMessage): string | undefined {
  const c = m.content as unknown as AnyRec;
  const type = c['@type'] as string;
  if (REGULAR_CONTENT.has(type)) return undefined;
  const chat = chats.get(m.chat_id);
  const isChannel = chat?.type['@type'] === 'chatTypeSupergroup' && chat.type.is_channel;
  const actor = senderNameOf(m);
  const senderUserId = m.sender_id.user_id;
  switch (type) {
    case 'messagePinMessage': {
      const pinned = findMessage(m.chat_id, c.message_id as number, true);
      if (pinned) {
        const text = contentPreview(pinned);
        if (text) return t('chat.service.pinned', { actor, text: shortQuote(text) });
      }
      return t('chat.service.pinnedMessage', { actor });
    }
    case 'messageChatAddMembers': {
      const ids = (c.member_user_ids as number[]) ?? [];
      if (ids.length === 1 && ids[0] === senderUserId) return t('chat.service.joined', { actor });
      return t('chat.service.added', { actor, target: ids.map(nameOfUserId).join(', ') });
    }
    case 'messageChatJoinByLink':
      return t('chat.service.joinedByLink', { actor });
    case 'messageChatJoinByRequest':
      return t('chat.service.joinedByRequest', { actor });
    case 'messageChatDeleteMember': {
      const uid = c.user_id as number;
      if (uid === senderUserId) return t('chat.service.left', { actor });
      return t('chat.service.removed', { actor, target: nameOfUserId(uid) });
    }
    case 'messageChatChangeTitle':
      return isChannel
        ? t('chat.service.channelTitle', { title: c.title })
        : t('chat.service.groupTitle', { actor, title: c.title });
    case 'messageChatChangePhoto':
      return isChannel ? t('chat.service.channelPhoto') : t('chat.service.groupPhoto', { actor });
    case 'messageChatDeletePhoto':
      return isChannel ? t('chat.service.channelPhotoRemoved') : t('chat.service.groupPhotoRemoved', { actor });
    case 'messageBasicGroupChatCreate':
      return t('chat.service.groupCreated', { actor, title: c.title });
    case 'messageSupergroupChatCreate':
      return isChannel ? t('chat.service.channelCreated') : t('chat.service.groupCreated', { actor, title: c.title });
    case 'messageChatUpgradeTo':
    case 'messageChatUpgradeFrom':
      return t('chat.service.upgraded');
    case 'messageContactRegistered':
      return t('chat.service.contactJoined', { actor });
    case 'messageScreenshotTaken':
      return t('chat.service.screenshot', { actor });
    case 'messageChatSetMessageAutoDeleteTime': {
      const time = c.message_auto_delete_time as number;
      return time > 0
        ? t('chat.service.autoDeleteOn', { actor, time: formatPeriod(time) })
        : t('chat.service.autoDeleteOff', { actor });
    }
    case 'messageGameScore':
      return t('chat.service.gameScore', { actor, score: c.score });
    case 'messageCall': {
      const reason = c.discard_reason?.['@type'] as string | undefined;
      const video = c.is_video as boolean;
      let key: string;
      if (m.is_outgoing) key = reason === 'callDiscardReasonMissed' || reason === 'callDiscardReasonDeclined' ? 'chat.call.cancelled' : 'chat.call.outgoing';
      else key = reason === 'callDiscardReasonMissed' ? 'chat.call.missed' : reason === 'callDiscardReasonDeclined' ? 'chat.call.declined' : 'chat.call.incoming';
      const base = `${video ? '📹' : '📞'} ${t(video ? `${key}Video` : key)}`;
      return c.duration > 0 ? `${base} (${formatCallDuration(c.duration)})` : base;
    }
    case 'messageGroupCall':
      return c.is_active ? t('chat.service.videoChatStarted', { actor }) : t('chat.service.videoChatEnded', { duration: formatCallDuration(c.duration ?? 0) });
    case 'messageVideoChatStarted':
      return isChannel ? t('chat.service.liveStreamStarted') : t('chat.service.videoChatStarted', { actor });
    case 'messageVideoChatEnded':
      return t('chat.service.videoChatEnded', { duration: formatCallDuration(c.duration ?? 0) });
    case 'messageVideoChatScheduled':
      return t('chat.service.videoChatScheduled', { actor });
    case 'messageInviteVideoChatParticipants':
      return t('chat.service.videoChatInvited', { actor, target: ((c.user_ids as number[]) ?? []).map(nameOfUserId).join(', ') });
    case 'messageGiftedPremium':
      return t('chat.service.giftedPremium', { actor, months: c.month_count ?? 0 });
    case 'messagePremiumGiftCode':
      return t('chat.service.premiumGiftCode');
    case 'messageGiftedStars':
      return t('chat.service.giftedStars', { actor, n: c.star_count ?? 0 });
    case 'messageGift':
    case 'messageUpgradedGift':
    case 'messageRefundedUpgradedGift':
      return t('chat.service.gift', { actor });
    case 'messageForumTopicCreated':
      return t('chat.service.topicCreated', { name: c.name });
    case 'messageForumTopicEdited':
      return c.name ? t('chat.service.topicRenamed', { actor, name: c.name }) : t('chat.service.topicEdited', { actor });
    case 'messageForumTopicIsClosedToggled':
      return c.is_closed ? t('chat.service.topicClosed', { actor }) : t('chat.service.topicReopened', { actor });
    case 'messageChatBoost':
      return tp('chat.service.boost', c.boost_count ?? 1, { actor });
    case 'messageCustomServiceAction':
      return String(c.text ?? '');
    case 'messageChatSetTheme':
      return t('chat.service.theme', { actor });
    case 'messageChatSetBackground':
      return t('chat.service.wallpaper', { actor });
    case 'messageExpiredPhoto':
      return t('chat.service.expiredPhoto');
    case 'messageExpiredVideo':
      return t('chat.service.expiredVideo');
    case 'messageExpiredVoiceNote':
      return t('chat.service.expiredVoice');
    case 'messageExpiredVideoNote':
      return t('chat.service.expiredVideoNote');
    case 'messageBotWriteAccessAllowed':
      return t('chat.service.botAllowed');
    case 'messageWebAppDataSent':
      return t('chat.service.webAppData', { text: c.button_text });
    case 'messageChatOwnerChanged':
      return t('chat.service.ownerChanged', { target: nameOfUserId(c.new_owner_user_id) });
    case 'messagePaymentSuccessful':
    case 'messagePaymentSuccessfulBot':
      return t('chat.service.payment');
    default:
      return t('chat.service.generic');
  }
}

/** Tarixdan yoki keshdan xabar; topilmasa (lazy=true) fon rejimida yuklaydi. */
function findMessage(chatId: number, messageId: number, lazy: boolean): TdMessage | undefined {
  if (!messageId) return undefined;
  const inHistory = history.get(chatId)?.find((x) => x.id === messageId);
  if (inHistory) return inHistory;
  const key = `${chatId}:${messageId}`;
  const cached = extraMessages.get(key);
  if (cached !== undefined) return cached ?? undefined;
  if (lazy && !pendingExtra.has(key)) {
    pendingExtra.add(key);
    td<TdMessage & TdObject>({ '@type': 'getMessage', chat_id: chatId, message_id: messageId })
      .then((msg) => extraMessages.set(key, msg))
      .catch(() => extraMessages.set(key, null))
      .finally(() => {
        pendingExtra.delete(key);
        touchHistory(chatId);
        scheduleFlush();
      });
  }
  return undefined;
}

function senderOf(m: TdMessage): { id: string; preview: UserPreview } {
  if (m.sender_id['@type'] === 'messageSenderUser' && m.sender_id.user_id) {
    const u = ensureUser(m.sender_id.user_id);
    if (m.is_outgoing) return { id: 'me', preview: userPreview(u, 'me') };
    return { id: String(m.sender_id.user_id), preview: userPreview(u, String(m.sender_id.user_id)) };
  }
  const chatId = m.sender_id.chat_id ?? m.chat_id;
  const chat = ensureChat(chatId);
  const id = m.is_outgoing ? 'me' : String(chatId);
  return {
    id,
    preview: {
      id: String(chatId),
      firstName: chat?.title ?? '',
      status: 'offline',
      isVerified: false,
      avatarUrl: fileUri(chat?.photo?.small),
      colorId: colorOf(chat?.accent_color_id, chatId),
    },
  };
}

function originName(o: TdMessageOrigin): string {
  switch (o['@type']) {
    case 'messageOriginUser':
      return userName(ensureUser(o.sender_user_id));
    case 'messageOriginHiddenUser':
      return o.sender_name;
    case 'messageOriginChat': {
      const title = ensureChat(o.sender_chat_id)?.title ?? '';
      return o.author_signature ? `${title} (${o.author_signature})` : title;
    }
    case 'messageOriginChannel': {
      const title = ensureChat(o.chat_id)?.title ?? '';
      return o.author_signature ? `${title} (${o.author_signature})` : title;
    }
    default:
      return '';
  }
}

/** Javob blok ma'lumoti: javob berilgan xabar lazy yuklanadi. */
function replyOf(m: TdMessage): MessageReply | null {
  const r = m.reply_to;
  if (!r || r['@type'] !== 'messageReplyToMessage') return null;
  const quote = r.quote?.text?.text || undefined;
  const sameChat = !r.chat_id || r.chat_id === m.chat_id;
  let target: TdMessage | undefined;
  if (sameChat) {
    target = history.get(m.chat_id)?.find((x) => x.id === r.message_id);
  }
  const key = `reply:${m.chat_id}:${m.id}`;
  if (!target) {
    const cached = extraMessages.get(key);
    if (cached) target = cached;
    else if (cached === undefined && r.message_id && !pendingExtra.has(key) && !r.origin) {
      pendingExtra.add(key);
      td<TdMessage & TdObject>({ '@type': 'getRepliedMessage', chat_id: m.chat_id, message_id: m.id })
        .then((msg) => extraMessages.set(key, msg))
        .catch(() => extraMessages.set(key, null))
        .finally(() => {
          pendingExtra.delete(key);
          touchHistory(m.chat_id);
          scheduleFlush();
        });
    }
  }
  if (target) {
    const s = senderOf(target);
    return {
      messageId: String(target.id),
      chatId: String(target.chat_id),
      senderId: s.id,
      senderName: senderNameOf(target) || s.preview.firstName,
      contentPreview: contentPreview(target),
      type: 'text',
      quote,
      colorId: s.preview.colorId,
    };
  }
  if (r.origin) {
    // Boshqa chatdagi (yoki yashirin) xabarga javob: origin + kontent nusxasi.
    const fake = { ...m, content: (r.content ?? { '@type': 'messageText', text: { text: '' } }) as TdMessageContent };
    return {
      messageId: String(r.message_id ?? 0),
      chatId: r.chat_id ? String(r.chat_id) : undefined,
      senderId: '',
      senderName: originName(r.origin),
      contentPreview: r.content ? contentPreview(fake) : '',
      type: 'text',
      quote,
    };
  }
  const loading = pendingExtra.has(key);
  return {
    messageId: String(r.message_id ?? 0),
    chatId: String(r.chat_id ?? m.chat_id),
    senderId: '',
    senderName: '',
    contentPreview: loading ? t('common.loading') : t('chat.deletedMessage'),
    type: 'text',
    quote,
    isLoading: loading,
  };
}

function toEntities(ft: TdFormattedText | undefined | null): TextEntity[] | undefined {
  const list = ft?.entities;
  if (!list || list.length === 0) return undefined;
  return list.map((e) => ({
    offset: e.offset,
    length: e.length,
    type: e.type['@type'].replace(/^textEntityType/, ''),
    url: e.type.url,
    userId: e.type.user_id != null ? String(e.type.user_id) : undefined,
    language: e.type.language || undefined,
  }));
}

function toMarkup(m: TdMessage): InlineButton[][] | undefined {
  const rm = m.reply_markup;
  if (!rm || rm['@type'] !== 'replyMarkupInlineKeyboard' || !rm.rows) return undefined;
  const kinds: Record<string, InlineButtonKind> = {
    inlineKeyboardButtonTypeUrl: 'url',
    inlineKeyboardButtonTypeLoginUrl: 'loginUrl',
    inlineKeyboardButtonTypeWebApp: 'webApp',
    inlineKeyboardButtonTypeCallback: 'callback',
    inlineKeyboardButtonTypeCallbackWithPassword: 'callbackWithPassword',
    inlineKeyboardButtonTypeCallbackGame: 'callbackGame',
    inlineKeyboardButtonTypeSwitchInline: 'switchInline',
    inlineKeyboardButtonTypeBuy: 'buy',
    inlineKeyboardButtonTypeUser: 'user',
    inlineKeyboardButtonTypeCopyText: 'copyText',
    inlineKeyboardButtonTypeDisabled: 'disabled',
  };
  return rm.rows.map((row) =>
    row.map((b) => {
      const ty = b.type as AnyRec;
      return {
        text: b.text,
        kind: kinds[ty['@type']] ?? 'unknown',
        url: typeof ty.url === 'string' ? ty.url : undefined,
        data: typeof ty.data === 'string' ? ty.data : undefined,
        userId: ty.user_id != null ? String(ty.user_id) : undefined,
        copyText: typeof ty.text === 'string' ? ty.text : undefined,
        query: typeof ty.query === 'string' ? ty.query : undefined,
      };
    }),
  );
}

type AnyFile = {
  id: number;
  size?: number;
  expected_size?: number;
  local: { path: string; is_downloading_completed: boolean };
  remote?: { uploaded_size?: number; is_uploading_active?: boolean };
};
type Mini = { width: number; height: number; data: string } | undefined;

function miniUri(mini: Mini): string | undefined {
  return mini?.data ? `data:image/jpeg;base64,${mini.data}` : undefined;
}

/** Fayl lokal bo'lsa uning URI'si; bo'lmasa yuklab olishni boshlaydi. */
function fileOrRequest(file: AnyFile | undefined): string | undefined {
  if (!file) return undefined;
  const uri = fileUri(file);
  if (!uri) requestFile(file);
  return uri;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64Bytes(b64: string): number[] {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of b64) {
    const v = B64.indexOf(ch);
    if (v < 0) continue; // '=' va bo'shliqlar
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

/** TDLib voice_note.waveform: base64, har qiymat 5 bit (0..31). */
function decodeWaveform(b64: string | undefined): number[] {
  if (!b64) return [];
  const bytes = base64Bytes(b64);
  const count = Math.floor((bytes.length * 8) / 5);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const bit = i * 5;
    const byte = bit >> 3;
    const shift = bit & 7;
    const value = ((bytes[byte] ?? 0) | ((bytes[byte + 1] ?? 0) << 8)) >> shift;
    out.push((value & 31) / 31);
  }
  return out;
}

/** Yuborilayotgan xabar fayli uchun upload jarayoni. */
function uploadOf(m: TdMessage, file: AnyFile | undefined): number | undefined {
  if (!file || m.sending_state?.['@type'] !== 'messageSendingStatePending') return undefined;
  const live = uploadProgressOf(file.id);
  if (live != null) return live;
  const size = file.size || file.expected_size || 0;
  return size > 0 ? Math.min(1, (file.remote?.uploaded_size ?? 0) / size) : 0;
}

/** Katta faylni (video/hujjat) avto-yuklash qoidasiga ko'ra yuklaydi. */
function autoFile(file: AnyFile | undefined, kind: 'photo' | 'video' | 'file'): void {
  if (!file || file.local.is_downloading_completed) return;
  if (shouldAutoDownload(kind, file.size || file.expected_size || 0)) requestFile(file);
}

/** Xabar kontentidan media va maxsus maydonlar. */
function mediaFields(m: TdMessage): Partial<ChatMessage> {
  const c = m.content as unknown as AnyRec;
  const caption = (c.caption?.text as string | undefined) || undefined;
  const captionEntities = toEntities(c.caption);
  switch (c['@type']) {
    case 'messageText': {
      const lp = c.link_preview as AnyRec | undefined;
      return {
        text: c.text?.text ?? '',
        entities: toEntities(c.text),
        linkPreview: lp
          ? {
              url: lp.url,
              siteName: lp.site_name || undefined,
              title: lp.title || undefined,
              description: lp.description?.text || undefined,
            }
          : undefined,
      };
    }
    case 'messagePhoto': {
      const sizes = (c.photo?.sizes ?? []) as { type: string; width: number; height: number; photo: AnyFile }[];
      // Ekran uchun ~1280px dan oshmaydigan eng kattasi.
      const best = [...sizes].filter((x) => x.width <= 1280).pop() ?? sizes[sizes.length - 1];
      const file = best?.photo;
      let uri = fileUri(file);
      if (!uri && file && shouldAutoDownload('photo', file.size || file.expected_size || 0)) {
        requestFile(file);
        uri = fileUri(file);
      }
      // Kichik o'lchamli nusxa (tezroq ko'rinadi) — doim yuklanadi.
      const small = sizes.find((x) => x.type === 'm') ?? sizes[0];
      const smallUri = small && small !== best ? fileOrRequest(small.photo) : undefined;
      return {
        type: 'image',
        mediaKind: 'photo',
        text: caption,
        entities: captionEntities,
        mediaUrl: uri,
        thumbUrl: smallUri ?? miniUri(c.photo?.minithumbnail),
        mediaWidth: best?.width,
        mediaHeight: best?.height,
        mediaFileId: file?.id,
        mediaLocalPath: filePath(file),
        fileSize: file?.size || file?.expected_size,
        needsDownload: !uri && !!file && !isFileRequested(file.id),
        downloadProgress: downloadProgressOf(file?.id),
        uploadProgress: uploadOf(m, file),
        mimeType: 'image/jpeg',
      };
    }
    case 'messageVideo':
    case 'messageAnimation':
    case 'messageVideoNote': {
      const v = c.video ?? c.animation ?? c.video_note;
      const kind = c['@type'] === 'messageVideo' ? 'video' : c['@type'] === 'messageAnimation' ? 'gif' : 'videoNote';
      const file = (v?.video ?? v?.animation) as AnyFile | undefined;
      autoFile(file, 'video');
      return {
        type: 'video',
        mediaKind: kind,
        text: caption,
        entities: captionEntities,
        thumbUrl: fileOrRequest(v?.thumbnail?.file) ?? miniUri(v?.minithumbnail),
        mediaWidth: v?.width ?? v?.length,
        mediaHeight: v?.height ?? v?.length,
        duration: v?.duration,
        mediaFileId: file?.id,
        mediaLocalPath: filePath(file),
        fileSize: file?.size || file?.expected_size,
        downloadProgress: downloadProgressOf(file?.id),
        uploadProgress: uploadOf(m, file),
        mimeType: v?.mime_type || 'video/mp4',
      };
    }
    case 'messageVoiceNote': {
      const vn = c.voice_note;
      return {
        type: 'voice',
        text: caption,
        entities: captionEntities,
        duration: vn?.duration,
        waveform: decodeWaveform(vn?.waveform),
        mediaFileId: vn?.voice?.id,
        mediaLocalPath: filePath(vn?.voice),
        uploadProgress: uploadOf(m, vn?.voice),
        mimeType: vn?.mime_type || 'audio/ogg',
      };
    }
    case 'messageAudio': {
      const au = c.audio;
      autoFile(au?.audio, 'file');
      return {
        type: 'audio',
        text: caption,
        entities: captionEntities,
        fileName: [au?.performer, au?.title].filter(Boolean).join(' — ') || au?.file_name || t('chat.preview.audio'),
        duration: au?.duration,
        mediaFileId: au?.audio?.id,
        mediaLocalPath: filePath(au?.audio),
        fileSize: au?.audio?.size,
        uploadProgress: uploadOf(m, au?.audio),
        mimeType: au?.mime_type || 'audio/mpeg',
      };
    }
    case 'messageDocument': {
      const d = c.document;
      autoFile(d?.document, 'file');
      return {
        type: 'document',
        text: caption,
        entities: captionEntities,
        fileName: d?.file_name || t('chat.preview.file'),
        fileSize: d?.document?.size || d?.document?.expected_size,
        mediaFileId: d?.document?.id,
        mediaLocalPath: filePath(d?.document),
        downloadProgress: downloadProgressOf(d?.document?.id),
        uploadProgress: uploadOf(m, d?.document),
        thumbUrl: miniUri(d?.minithumbnail),
        mimeType: d?.mime_type || 'application/octet-stream',
      };
    }
    case 'messageSticker': {
      const st = c.sticker;
      // Animatsiyali (tgs/webm) stikerlar uchun hozircha statik thumbnail.
      const isStatic = st?.format?.['@type'] === 'stickerFormatWebp';
      const uri = isStatic ? fileOrRequest(st?.sticker) : fileOrRequest(st?.thumbnail?.file);
      if (!uri && !st?.thumbnail && !isStatic) return { type: 'text', bigEmoji: st?.emoji || undefined, text: st?.emoji ? undefined : t('chat.preview.sticker') };
      return {
        type: 'image',
        mediaKind: 'sticker',
        mediaUrl: uri,
        mediaWidth: st?.width,
        mediaHeight: st?.height,
      };
    }
    case 'messageAnimatedEmoji':
    case 'messageDice':
      return { text: undefined, bigEmoji: c.emoji || '🎲' };
    case 'messageContact': {
      const ct = c.contact;
      return {
        text: undefined,
        contact: {
          name: [ct?.first_name, ct?.last_name].filter(Boolean).join(' '),
          phone: ct?.phone_number ?? '',
          userId: ct?.user_id ? String(ct.user_id) : undefined,
        },
      };
    }
    case 'messageLocation':
    case 'messageLiveLocation':
      return {
        text: undefined,
        location: { latitude: c.location?.latitude ?? 0, longitude: c.location?.longitude ?? 0 },
      };
    case 'messageVenue':
      return {
        text: undefined,
        location: {
          latitude: c.venue?.location?.latitude ?? 0,
          longitude: c.venue?.location?.longitude ?? 0,
          title: c.venue?.title || undefined,
          address: c.venue?.address || undefined,
        },
      };
    case 'messagePoll': {
      const p = c.poll as AnyRec;
      const raw = (p.options ?? []) as AnyRec[];
      const order = (p.option_order as number[] | undefined)?.length ? (p.option_order as number[]) : raw.map((_, i) => i);
      const hasVoted = raw.some((o) => o.is_chosen);
      const poll: PollInfo = {
        id: String(p.id),
        question: p.question?.text ?? '',
        questionEntities: toEntities(p.question),
        options: order
          .filter((i) => raw[i])
          .map((i) => ({
            id: String(i),
            text: raw[i]!.text?.text ?? '',
            voterCount: raw[i]!.voter_count ?? 0,
            percent: raw[i]!.vote_percentage ?? 0,
            isChosen: raw[i]!.is_chosen ?? false,
            isBeingChosen: raw[i]!.is_being_chosen ?? false,
          })),
        totalVoters: p.total_voter_count ?? 0,
        isClosed: p.is_closed ?? false,
        isAnonymous: p.is_anonymous ?? true,
        isQuiz: p.type?.['@type'] === 'pollTypeQuiz',
        allowsMultiple: p.allows_multiple_answers ?? false,
        hasVoted: hasVoted || (p.is_closed ?? false),
      };
      return { text: undefined, poll };
    }
    default:
      return {};
  }
}

export function toChatMessage(m: TdMessage): ChatMessage {
  const chat = chats.get(m.chat_id);
  const sender = senderOf(m);
  let status: ChatMessage['status'] = 'read';
  if (m.is_outgoing) {
    if (m.sending_state?.['@type'] === 'messageSendingStatePending') status = 'sending';
    else if (m.sending_state?.['@type'] === 'messageSendingStateFailed') status = 'failed';
    else status = chat && m.id <= chat.last_read_outbox_message_id ? 'read' : 'sent';
  }
  const service = serviceText(m);
  const preview = contentPreview(m);
  const info = m.interaction_info ?? undefined;
  const isChannelPost = m.is_channel_post ?? false;
  return {
    id: String(m.id),
    chatId: String(m.chat_id),
    senderId: sender.id,
    senderPreview: sender.preview,
    senderName: senderNameOf(m) || sender.preview.firstName,
    senderColorId: sender.preview.colorId,
    type: service ? 'system' : 'text',
    text: service ?? preview,
    previewText: preview,
    ...(service ? {} : mediaFields(m)),
    isService: service !== undefined,
    status,
    sentAt: new Date(m.date * 1000),
    editedAt: m.edit_date ? new Date(m.edit_date * 1000) : undefined,
    isEdited: (m.edit_date ?? 0) > 0 && !m.reply_markup,
    isDeleted: false,
    isPinned: m.is_pinned ?? false,
    isChannelPost,
    viewCount: info?.view_count || undefined,
    hasComments: isChannelPost && info?.reply_info != null,
    replyCount: info?.reply_info?.reply_count,
    authorSignature: m.author_signature || undefined,
    forwardFrom: m.forward_info ? originName(m.forward_info.origin) || t('chat.unknown') : undefined,
    replyTo: replyOf(m),
    replyMarkup: toMarkup(m),
    reactions: (info?.reactions?.reactions ?? [])
      .filter((r) => r.type['@type'] === 'reactionTypeEmoji' && r.type.emoji)
      .map((r) => ({
        emoji: r.type.emoji!,
        count: r.total_count,
        userIds: r.is_chosen ? ['me'] : [],
        hasCurrentUser: r.is_chosen,
      })),
  };
}

const typing = new Map<string, { chatId: number; name: string; action: string; timer: ReturnType<typeof setTimeout> }>();

const ACTION_KEY: Record<string, string> = {
  chatActionTyping: 'typing',
  chatActionRecordingVoiceNote: 'recordingVoice',
  chatActionUploadingVoiceNote: 'uploadingVoice',
  chatActionUploadingPhoto: 'uploadingPhoto',
  chatActionUploadingVideo: 'uploadingVideo',
  chatActionRecordingVideo: 'recordingVideo',
  chatActionRecordingVideoNote: 'recordingVideoNote',
  chatActionUploadingVideoNote: 'uploadingVideoNote',
  chatActionUploadingDocument: 'uploadingDocument',
  chatActionChoosingSticker: 'choosingSticker',
  chatActionChoosingLocation: 'choosingLocation',
  chatActionChoosingContact: 'choosingContact',
  chatActionStartPlayingGame: 'playingGame',
  chatActionWatchingAnimations: 'watchingAnimations',
};

/** Chatda kim nima qilyapti: "Ali yozmoqda" / "yozmoqda". */
export function typingText(chatIdStr: string): string | undefined {
  const id = Number(chatIdStr);
  const chat = chats.get(id);
  const isPrivate = chat?.type['@type'] === 'chatTypePrivate' || chat?.type['@type'] === 'chatTypeSecret';
  for (const tp0 of typing.values()) {
    if (tp0.chatId !== id) continue;
    const key = ACTION_KEY[tp0.action] ?? 'typing';
    return isPrivate || !tp0.name ? t(`chat.action.${key}`) : t(`chat.action.${key}Named`, { name: tp0.name });
  }
  return undefined;
}

function toChat(c: TdChat, key = 'main'): Chat {
  const pos = key === 'main' ? mainPosition(c) : positionIn(c, key);
  let type: Chat['type'] = 'private';
  let otherUser: UserPreview | undefined;
  if (c.type['@type'] === 'chatTypeBasicGroup') type = 'group';
  if (c.type['@type'] === 'chatTypeSupergroup') type = c.type.is_channel ? 'channel' : 'group';
  if (c.type.user_id) {
    otherUser = userPreview(users.get(c.type.user_id), String(c.type.user_id));
  }
  const tt = c.type as TdChat['type'] & { basic_group_id?: number; supergroup_id?: number };
  const count = tt.basic_group_id
    ? basicGroupCounts.get(tt.basic_group_id)
    : tt.supergroup_id
    ? supergroupCounts.get(tt.supergroup_id)
    : undefined;
  return {
    id: String(c.id),
    type,
    name: c.title,
    avatarUrl: fileUri(c.photo?.small),
    lastMessage: c.last_message ? toChatMessage(c.last_message) : null,
    unreadCount: c.unread_count,
    isPinned: pos?.is_pinned ?? false,
    isMuted: c.notification_settings.mute_for > 0,
    isArchived: positionIn(c, 'archive') !== undefined,
    isMarkedUnread: c.is_marked_as_unread ?? false,
    otherUser,
    memberCount: count || undefined,
    isOnline: otherUser?.status === 'online',
    isTyping: typingText(String(c.id)) !== undefined,
    typingUserName: typingText(String(c.id)),
    updatedAt: new Date((c.last_message?.date ?? 0) * 1000),
  };
}

// ---------------------------------------------------------------------------
// Store'ga yozish (update'lar ko'p keladi — 100 ms ga yig'ib yoziladi)
// ---------------------------------------------------------------------------

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(flush, 100);
}

/** Ikki UI qiymatini chuqur taqqoslash (Date ham). */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!same((a as AnyRec)[k], (b as AnyRec)[k])) return false;
  }
  return true;
}

function buildHistory(chatId: number): ChatMessage[] {
  const prev = lastUi.get(chatId) ?? new Map<string, ChatMessage>();
  const next = new Map<string, ChatMessage>();
  const out = (history.get(chatId) ?? []).map((tm) => {
    const fresh = toChatMessage(tm);
    const old = prev.get(fresh.id);
    const msg = old && same(old, fresh) ? old : fresh;
    next.set(msg.id, msg);
    return msg;
  });
  lastUi.set(chatId, next);
  return out;
}

function flush(): void {
  flushTimer = null;
  const build = (key: string) =>
    [...chats.values()]
      .filter((c) => {
        const p = positionIn(c, key);
        return p !== undefined && p.order !== '0';
      })
      .sort((a, b) => compareOrderDesc(positionIn(a, key)!.order, positionIn(b, key)!.order))
      .map((c) => toChat(c, key));
  const store = useChatStore.getState();
  store.setChats(build('main'));
  const listChats: Record<string, Chat[]> = { archive: build('archive') };
  for (const f of store.folders) listChats[`folder:${f.id}`] = build(`folder:${f.id}`);
  useChatStore.setState({ listChats });
  dirtyHistory.forEach((chatId) => {
    store.setMessages(String(chatId), buildHistory(chatId));
  });
  dirtyHistory.clear();
}

function touchHistory(chatId: number): void {
  if (history.has(chatId)) dirtyHistory.add(chatId);
}

/** Til o'zgarganda va h.k.: chat tarixini qayta hisoblab chizadi. */
export function refreshHistory(chatIdStr: string): void {
  touchHistory(Number(chatIdStr));
  scheduleFlush();
}

function updateChat(chatId: number, patch: Partial<TdChat>): void {
  const chat = chats.get(chatId);
  if (!chat) return;
  chats.set(chatId, { ...chat, ...patch });
}

function setPosition(chatId: number, position: TdChat['positions'][number]): void {
  const chat = chats.get(chatId);
  if (!chat) return;
  const key = listKey(position.list as TdChatList);
  const others = chat.positions.filter((p) => listKey(p.list as TdChatList) !== key);
  chats.set(chatId, { ...chat, positions: position.order === '0' ? others : [...others, position] });
}

function findInHistory(chatId: number, messageId: number): TdMessage | undefined {
  return history.get(chatId)?.find((x) => x.id === messageId);
}

function handleUpdate(u: TdObject): void {
  switch (u['@type']) {
    case 'updateNewChat': {
      const chat = u.chat as TdChat;
      chats.set(chat.id, chat);
      requestFile(chat.photo?.small);
      break;
    }
    case 'updateChatTitle':
      updateChat(u.chat_id as number, { title: u.title as string });
      break;
    case 'updateChatPhoto': {
      const photo = u.photo as TdChat['photo'];
      updateChat(u.chat_id as number, { photo });
      requestFile(photo?.small);
      break;
    }
    case 'updateChatAccentColors':
      updateChat(u.chat_id as number, { accent_color_id: u.accent_color_id as number });
      break;
    case 'updateChatPermissions':
      updateChat(u.chat_id as number, { permissions: u.permissions as Record<string, boolean> });
      break;
    case 'updateChatDraftMessage': {
      const chatId = u.chat_id as number;
      updateChat(chatId, { draft_message: (u.draft_message as TdChat['draft_message']) ?? null });
      for (const p of (u.positions as TdChat['positions']) ?? []) setPosition(chatId, p);
      break;
    }
    case 'updateChatLastMessage': {
      const chatId = u.chat_id as number;
      updateChat(chatId, { last_message: u.last_message as TdMessage | undefined });
      for (const p of (u.positions as TdChat['positions']) ?? []) setPosition(chatId, p);
      break;
    }
    case 'updateChatPosition':
      setPosition(u.chat_id as number, u.position as TdChat['positions'][number]);
      break;
    case 'updateChatReadInbox':
      updateChat(u.chat_id as number, {
        unread_count: u.unread_count as number,
        last_read_inbox_message_id: u.last_read_inbox_message_id as number,
      });
      break;
    case 'updateChatReadOutbox':
      updateChat(u.chat_id as number, {
        last_read_outbox_message_id: u.last_read_outbox_message_id as number,
      });
      touchHistory(u.chat_id as number);
      break;
    case 'updateChatIsMarkedAsUnread':
      updateChat(u.chat_id as number, { is_marked_as_unread: u.is_marked_as_unread as boolean });
      break;
    case 'updateChatAction': {
      // "yozmoqda..." — 6 soniyada o'zi o'chadi (TDLib ham shunday tavsiya qiladi).
      const chatId = u.chat_id as number;
      const sender = u.sender_id as TdMessage['sender_id'];
      const action = (u.action as { '@type': string })['@type'];
      const key = `${chatId}:${sender.user_id ?? sender.chat_id}`;
      const prev = typing.get(key);
      if (prev) clearTimeout(prev.timer);
      if (action === 'chatActionCancel') {
        typing.delete(key);
      } else {
        const name = sender.user_id ? users.get(sender.user_id)?.first_name ?? '' : '';
        const timer = setTimeout(() => {
          typing.delete(key);
          scheduleFlush();
        }, 6000);
        typing.set(key, { chatId, name, action, timer });
      }
      break;
    }
    case 'updateChatNotificationSettings':
      updateChat(u.chat_id as number, {
        notification_settings: u.notification_settings as TdChat['notification_settings'],
      });
      break;
    case 'updateUser': {
      const user = u.user as TdUser;
      users.set(user.id, user);
      requestFile(user.profile_photo?.small);
      break;
    }
    case 'updateChatFolders': {
      const list = u.chat_folders as { id: number; name: { text: { text: string } } }[];
      const prev = useChatStore.getState().folders;
      useChatStore.setState({
        folders: list.map((f) => ({
          id: f.id,
          name: f.name.text.text,
          unreadCount: prev.find((p) => p.id === f.id)?.unreadCount ?? 0,
        })),
      });
      for (const f of list) void loadMoreChats(`folder:${f.id}`);
      break;
    }
    case 'updateUnreadChatCount': {
      const key = listKey(u.chat_list as TdChatList);
      if (!key.startsWith('folder:')) return;
      const id = Number(key.slice(7));
      useChatStore.setState((st) => ({
        folders: st.folders.map((f) => (f.id === id ? { ...f, unreadCount: u.unread_count as number } : f)),
      }));
      return;
    }
    case 'updateBasicGroup': {
      const g = u.basic_group as { id: number; member_count: number; status: { '@type': string } };
      basicGroupCounts.set(g.id, g.member_count);
      basicGroupStatus.set(g.id, g.status['@type']);
      break;
    }
    case 'updateSupergroup': {
      const g = u.supergroup as TdSupergroup;
      supergroups.set(g.id, g);
      // member_count 0 bo'lishi mumkin (to'liq ma'lumot hali yo'q) — eski qiymatni saqlaymiz.
      if (g.member_count > 0) supergroupCounts.set(g.id, g.member_count);
      break;
    }
    case 'updateSupergroupFullInfo': {
      const info = u.supergroup_full_info as { member_count: number };
      if (info.member_count > 0) supergroupCounts.set(u.supergroup_id as number, info.member_count);
      break;
    }
    case 'updateUserStatus': {
      const user = users.get(u.user_id as number);
      if (user) users.set(user.id, { ...user, status: u.status as TdUser['status'] });
      break;
    }
    case 'updateNewMessage': {
      const m = u.message as TdMessage;
      const list = history.get(m.chat_id);
      if (list && !list.some((x) => x.id === m.id)) {
        list.push(m);
        touchHistory(m.chat_id);
      }
      break;
    }
    case 'updateMessageSendSucceeded':
    case 'updateMessageSendFailed': {
      const m = u.message as TdMessage;
      const list = history.get(m.chat_id);
      const i = list?.findIndex((x) => x.id === (u.old_message_id as number)) ?? -1;
      if (list && i >= 0) {
        list[i] = m;
        touchHistory(m.chat_id);
      }
      break;
    }
    case 'updateMessageContent': {
      const chatId = u.chat_id as number;
      const m = findInHistory(chatId, u.message_id as number);
      if (m) {
        m.content = u.new_content as TdMessage['content'];
        touchHistory(chatId);
      }
      const cached = extraMessages.get(`${chatId}:${u.message_id}`);
      if (cached) cached.content = u.new_content as TdMessage['content'];
      break;
    }
    case 'updateMessageEdited': {
      const m = findInHistory(u.chat_id as number, u.message_id as number);
      if (m) {
        m.edit_date = u.edit_date as number;
        m.reply_markup = (u.reply_markup as TdMessage['reply_markup']) ?? null;
        touchHistory(m.chat_id);
      }
      break;
    }
    case 'updateMessageInteractionInfo': {
      const m = findInHistory(u.chat_id as number, u.message_id as number);
      if (m) {
        m.interaction_info = u.interaction_info as TdMessage['interaction_info'];
        touchHistory(m.chat_id);
      }
      break;
    }
    case 'updateMessageIsPinned': {
      const m = findInHistory(u.chat_id as number, u.message_id as number);
      if (m) {
        m.is_pinned = u.is_pinned as boolean;
        touchHistory(m.chat_id);
      }
      pinnedListeners.forEach((fn) => fn(String(u.chat_id)));
      break;
    }
    case 'updateDeleteMessages': {
      if (!u.is_permanent) return;
      const chatId = u.chat_id as number;
      const ids = new Set(u.message_ids as number[]);
      const list = history.get(chatId);
      if (list) {
        history.set(chatId, list.filter((x) => !ids.has(x.id)));
        touchHistory(chatId);
      }
      pinnedListeners.forEach((fn) => fn(String(chatId)));
      break;
    }
    default:
      return;
  }
  scheduleFlush();
}

const pinnedListeners = new Set<(chatId: string) => void>();

/** Qadalgan xabarlar o'zgarganda (pin/unpin/o'chirish). */
export function onPinnedChanged(fn: (chatId: string) => void): () => void {
  pinnedListeners.add(fn);
  return () => {
    pinnedListeners.delete(fn);
  };
}

// ---------------------------------------------------------------------------
// Ochiq API
// ---------------------------------------------------------------------------

/** Avtorizatsiyadan keyin: update'larni tinglash va asosiy ro'yxatni yuklash. */
export function startChatSync(): void {
  if (!unsubscribe) unsubscribe = onTdUpdate(handleUpdate);
  if (!unsubscribeFiles) unsubscribeFiles = onFilesChanged(() => {
    history.forEach((_, chatId) => dirtyHistory.add(chatId));
    scheduleFlush();
  });
  td<TdUser & TdObject>({ '@type': 'getMe' })
    .then((me) => {
      myUserId = me.id;
      users.set(me.id, me);
    })
    .catch(() => undefined);
  void loadMoreChats();
  void loadMoreChats('archive', 30);
}

export function stopChatSync(): void {
  chats.clear();
  users.clear();
  history.clear();
  supergroups.clear();
  extraMessages.clear();
  lastUi.clear();
  myUserId = 0;
  useChatStore.getState().setChats([]);
  useChatStore.setState({ folders: [], listChats: {} });
}

/** Asosiy ro'yxatdan yana chat yuklaydi; hammasi yuklangan bo'lsa false. */
export async function loadMoreChats(key = 'main', limit = 50): Promise<boolean> {
  useChatStore.setState({ isLoadingChats: true });
  try {
    await td({ '@type': 'loadChats', chat_list: tdList(key), limit });
    return true;
  } catch {
    // 404 — ro'yxat oxiriga yetildi.
    return false;
  } finally {
    useChatStore.setState({ isLoadingChats: false });
  }
}

/** Tarix oxiriga (eng eski xabar) yetilganmi. */
const historyEnd = new Set<number>();

/** Chat tarixini yuklaydi (TDLib birinchi javobda kam xabar qaytarishi mumkin). */
export async function loadHistory(chatIdStr: string, wanted = 40): Promise<void> {
  const chatId = Number(chatIdStr);
  const list = history.get(chatId) ?? [];
  history.set(chatId, list);
  let fromId = list.length > 0 ? list[0]!.id : 0;
  for (let attempt = 0; attempt < 5 && list.length < wanted; attempt++) {
    const res = await td<TdObject & { messages: (TdMessage | null)[] }>({
      '@type': 'getChatHistory',
      chat_id: chatId,
      from_message_id: fromId,
      offset: 0,
      limit: Math.min(100, wanted),
      only_local: false,
    });
    const older = res.messages.filter((m): m is TdMessage => m !== null);
    const known = new Set(list.map((m) => m.id));
    const fresh = older.filter((m) => !known.has(m.id));
    if (fresh.length === 0) {
      if (fromId !== 0) historyEnd.add(chatId);
      break;
    }
    // TDLib yangidan eskiga qaytaradi; bizda eskidan yangiga.
    list.unshift(...fresh.reverse());
    fromId = list[0]!.id;
  }
  dirtyHistory.add(chatId);
  flush();
}

/** Yuqoriga aylantirilganda eski xabarlarni yuklaydi; boshqa yo'q bo'lsa false. */
export async function loadOlderMessages(chatIdStr: string): Promise<boolean> {
  const chatId = Number(chatIdStr);
  if (historyEnd.has(chatId)) return false;
  const before = history.get(chatId)?.length ?? 0;
  await loadHistory(chatIdStr, before + 50);
  return (history.get(chatId)?.length ?? 0) > before;
}

/** Xabar tarixda bo'lmasa — unga yetguncha eski xabarlarni yuklaydi. */
export async function ensureMessageLoaded(chatIdStr: string, messageIdStr: string): Promise<boolean> {
  const chatId = Number(chatIdStr);
  const id = Number(messageIdStr);
  for (let i = 0; i < 20; i++) {
    const list = history.get(chatId) ?? [];
    if (list.some((m) => m.id === id)) return true;
    if (list.length > 0 && list[0]!.id < id) return false; // o'chirilgan
    const more = await loadOlderMessages(chatIdStr).catch(() => false);
    if (!more) return false;
  }
  return false;
}

export async function openChat(chatIdStr: string): Promise<void> {
  await td({ '@type': 'openChat', chat_id: Number(chatIdStr) }).catch(() => undefined);
}

export async function closeChat(chatIdStr: string): Promise<void> {
  await td({ '@type': 'closeChat', chat_id: Number(chatIdStr) }).catch(() => undefined);
}

/** O'qilgan deb belgilash (Telegram'ga "o'qildi" yuboradi). */
export async function markRead(chatIdStr: string): Promise<void> {
  const chatId = Number(chatIdStr);
  const list = history.get(chatId);
  if (!list || list.length === 0) return;
  await td({
    '@type': 'viewMessages',
    chat_id: chatId,
    message_ids: list.slice(-50).map((m) => m.id),
    force_read: true,
  }).catch(() => undefined);
}

const lastTyping = new Map<string, number>();

/**
 * "Yozmoqda..." holatini yuboradi (4 soniyada ko'pi bilan bir marta).
 * Ghost mode keyinroq shu funksiyani o'chiradi.
 */
export function sendTyping(chatIdStr: string, action: 'chatActionTyping' | 'chatActionRecordingVoiceNote' | 'chatActionCancel' = 'chatActionTyping'): void {
  const key = `${chatIdStr}:${action}`;
  const now = Date.now();
  if (action !== 'chatActionCancel' && now - (lastTyping.get(key) ?? 0) < 4000) return;
  lastTyping.set(key, now);
  if (action === 'chatActionCancel') lastTyping.clear();
  td({
    '@type': 'sendChatAction',
    chat_id: Number(chatIdStr),
    topic_id: null,
    business_connection_id: '',
    action: { '@type': action },
  }).catch(() => undefined);
}

function replyToInput(replyToId?: string) {
  return replyToId
    ? { '@type': 'inputMessageReplyToMessage', message_id: Number(replyToId), quote: null }
    : null;
}

function fmt(text: string | undefined) {
  return text ? { '@type': 'formattedText', text, entities: [] } : null;
}

function pushSent(chatId: number, sent: TdMessage): void {
  const list = history.get(chatId);
  if (list && !list.some((x) => x.id === sent.id)) {
    list.push(sent);
    dirtyHistory.add(chatId);
    scheduleFlush();
  }
}

export async function sendText(chatIdStr: string, text: string, replyToId?: string): Promise<void> {
  const chatId = Number(chatIdStr);
  const sent = await td<TdMessage & TdObject>({
    '@type': 'sendMessage',
    chat_id: chatId,
    reply_to: replyToInput(replyToId),
    input_message_content: {
      '@type': 'inputMessageText',
      text: { '@type': 'formattedText', text, entities: [] },
      link_preview_options: null,
      clear_draft: true,
    },
  });
  pushSent(chatId, sent);
}

export interface OutgoingMedia {
  kind: 'photo' | 'video' | 'document';
  /** Lokal yo'l (file:// bo'lmasa ham bo'ladi). */
  path: string;
  width?: number;
  height?: number;
  /** Soniya. */
  duration?: number;
}

function localFile(path: string) {
  return { '@type': 'inputFileLocal', path: path.replace(/^file:\/\//, '') };
}

function mediaContent(item: OutgoingMedia, caption?: string): TdObject {
  const cap = fmt(caption);
  if (item.kind === 'photo') {
    return {
      '@type': 'inputMessagePhoto',
      photo: {
        '@type': 'inputPhoto',
        photo: localFile(item.path),
        thumbnail: null,
        video: null,
        added_sticker_file_ids: [],
        width: Math.round(item.width ?? 0),
        height: Math.round(item.height ?? 0),
      },
      caption: cap,
      show_caption_above_media: false,
      self_destruct_type: null,
      has_spoiler: false,
    };
  }
  if (item.kind === 'video') {
    return {
      '@type': 'inputMessageVideo',
      video: {
        '@type': 'inputVideo',
        video: localFile(item.path),
        thumbnail: null,
        cover: null,
        start_timestamp: 0,
        added_sticker_file_ids: [],
        duration: Math.round(item.duration ?? 0),
        width: Math.round(item.width ?? 0),
        height: Math.round(item.height ?? 0),
        supports_streaming: true,
      },
      caption: cap,
      show_caption_above_media: false,
      self_destruct_type: null,
      has_spoiler: false,
    };
  }
  return {
    '@type': 'inputMessageDocument',
    document: {
      '@type': 'inputDocument',
      document: localFile(item.path),
      thumbnail: null,
      disable_content_type_detection: false,
    },
    caption: cap,
  };
}

/** Rasm/video/fayl yuboradi; 2..10 ta rasm/video — albom bo'lib ketadi. Izoh birinchisiga. */
export async function sendMedia(chatIdStr: string, items: OutgoingMedia[], caption?: string, replyToId?: string): Promise<void> {
  const chatId = Number(chatIdStr);
  if (items.length === 0) return;
  const visual = items.every((i) => i.kind !== 'document');
  if (items.length > 1 && items.length <= 10 && visual) {
    const res = await td<TdObject & { messages: TdMessage[] }>({
      '@type': 'sendMessageAlbum',
      chat_id: chatId,
      topic_id: null,
      reply_to: replyToInput(replyToId),
      options: null,
      input_message_contents: items.map((it, i) => mediaContent(it, i === 0 ? caption : undefined)),
    });
    res.messages.forEach((m) => pushSent(chatId, m));
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const sent = await td<TdMessage & TdObject>({
      '@type': 'sendMessage',
      chat_id: chatId,
      reply_to: i === 0 ? replyToInput(replyToId) : null,
      input_message_content: mediaContent(items[i]!, i === 0 ? caption : undefined),
    });
    pushSent(chatId, sent);
  }
}

/** Ovozli xabar (ogg/opus) yoki boshqa formatda — audio sifatida. */
export async function sendVoice(
  chatIdStr: string,
  rec: { path: string; duration: number; isOgg: boolean; waveform: string },
  replyToId?: string,
): Promise<void> {
  const chatId = Number(chatIdStr);
  const duration = Math.max(1, Math.round(rec.duration));
  const content = rec.isOgg
    ? {
        '@type': 'inputMessageVoiceNote',
        voice_note: { '@type': 'inputVoiceNote', voice_note: localFile(rec.path), duration, waveform: rec.waveform },
        caption: null,
        self_destruct_type: null,
      }
    : {
        '@type': 'inputMessageAudio',
        audio: { '@type': 'inputAudio', audio: localFile(rec.path), album_cover_thumbnail: null, duration, title: '', performer: '' },
        caption: null,
      };
  const sent = await td<TdMessage & TdObject>({
    '@type': 'sendMessage',
    chat_id: chatId,
    reply_to: replyToInput(replyToId),
    input_message_content: content,
  });
  pushSent(chatId, sent);
}

/** O'z matnli xabarini (yoki izohini) tahrirlash. */
export async function editMessage(chatIdStr: string, messageId: string, text: string, isCaption: boolean): Promise<void> {
  const chatId = Number(chatIdStr);
  const edited = await td<TdMessage & TdObject>(
    isCaption
      ? {
          '@type': 'editMessageCaption',
          chat_id: chatId,
          message_id: Number(messageId),
          reply_markup: null,
          caption: fmt(text),
          show_caption_above_media: false,
        }
      : {
          '@type': 'editMessageText',
          chat_id: chatId,
          message_id: Number(messageId),
          reply_markup: null,
          input_message_content: {
            '@type': 'inputMessageText',
            text: { '@type': 'formattedText', text, entities: [] },
            link_preview_options: null,
            clear_draft: false,
          },
        },
  );
  const list = history.get(chatId);
  const i = list?.findIndex((x) => x.id === edited.id) ?? -1;
  if (list && i >= 0) {
    list[i] = edited;
    touchHistory(chatId);
    scheduleFlush();
  }
}

export async function deleteMessage(chatIdStr: string, messageId: string, forAll: boolean): Promise<void> {
  await td({
    '@type': 'deleteMessages',
    chat_id: Number(chatIdStr),
    message_ids: [Number(messageId)],
    revoke: forAll,
  });
}

export async function toggleReaction(
  chatIdStr: string,
  messageId: string,
  emoji: string,
  add: boolean,
): Promise<void> {
  await td({
    '@type': add ? 'addMessageReaction' : 'removeMessageReaction',
    chat_id: Number(chatIdStr),
    message_id: Number(messageId),
    reaction_type: { '@type': 'reactionTypeEmoji', emoji },
    ...(add ? { is_big: false, update_recent_reactions: true } : {}),
  }).catch(() => undefined);
}

export async function setPinned(chatIdStr: string, messageId: string, pinned: boolean): Promise<void> {
  await td(
    pinned
      ? {
          '@type': 'pinChatMessage',
          chat_id: Number(chatIdStr),
          message_id: Number(messageId),
          disable_notification: true,
          only_for_self: false,
        }
      : { '@type': 'unpinChatMessage', chat_id: Number(chatIdStr), message_id: Number(messageId) },
  );
}

export interface MessageProps {
  canBeEdited: boolean;
  canBePinned: boolean;
  canBeForwarded: boolean;
  canBeSaved: boolean;
  canBeCopied: boolean;
  canBeDeletedOnlyForSelf: boolean;
  canBeDeletedForAll: boolean;
  canGetLink: boolean;
  canBeReplied: boolean;
  canGetThread: boolean;
}

/** getMessageProperties: xabar ustida qaysi amallar mumkin. */
export async function getMessageProps(chatIdStr: string, messageId: string): Promise<MessageProps | null> {
  try {
    const p = await td<TdObject & Record<string, boolean>>({
      '@type': 'getMessageProperties',
      chat_id: Number(chatIdStr),
      message_id: Number(messageId),
    });
    return {
      canBeEdited: !!p.can_be_edited,
      canBePinned: !!p.can_be_pinned,
      canBeForwarded: !!p.can_be_forwarded,
      canBeSaved: !!p.can_be_saved,
      canBeCopied: !!p.can_be_copied,
      canBeDeletedOnlyForSelf: !!p.can_be_deleted_only_for_self,
      canBeDeletedForAll: !!p.can_be_deleted_for_all_users,
      canGetLink: !!p.can_get_link,
      canBeReplied: !!p.can_be_replied,
      canGetThread: !!p.can_get_message_thread,
    };
  } catch {
    return null;
  }
}

/** Ommaviy kanal/guruh xabari havolasi (t.me/...). */
export async function getMessageLink(chatIdStr: string, messageId: string): Promise<string> {
  const res = await td<TdObject & { link: string }>({
    '@type': 'getMessageLink',
    chat_id: Number(chatIdStr),
    message_id: Number(messageId),
    media_timestamp: 0,
    checklist_task_id: 0,
    poll_option_id: '',
    for_album: false,
    in_message_thread: false,
  });
  return res.link;
}

/** Inline callback tugma: botdan javob (matn, alert, havola). */
export async function pressCallbackButton(
  chatIdStr: string,
  messageId: string,
  data: string,
): Promise<{ text: string; showAlert: boolean; url: string }> {
  const res = await td<TdObject & { text: string; show_alert: boolean; url: string }>({
    '@type': 'getCallbackQueryAnswer',
    chat_id: Number(chatIdStr),
    message_id: Number(messageId),
    payload: { '@type': 'callbackQueryPayloadData', data },
  });
  return { text: res.text ?? '', showAlert: !!res.show_alert, url: res.url ?? '' };
}

export async function votePoll(chatIdStr: string, messageId: string, optionIds: number[]): Promise<void> {
  await td({ '@type': 'setPollAnswer', chat_id: Number(chatIdStr), message_id: Number(messageId), option_ids: optionIds });
}

/** Eng oxirgi qadalgan xabar (yo'q bo'lsa null). */
export async function loadPinnedMessage(chatIdStr: string): Promise<ChatMessage | null> {
  try {
    const m = await td<TdMessage & TdObject>({ '@type': 'getChatPinnedMessage', chat_id: Number(chatIdStr) });
    extraMessages.set(`${m.chat_id}:${m.id}`, m);
    return toChatMessage(m);
  } catch {
    return null;
  }
}

/** Chat ichida qidiruv: topilgan xabar id'lari (yangidan eskiga). */
export async function searchInChat(chatIdStr: string, query: string): Promise<string[]> {
  const res = await td<TdObject & { messages: TdMessage[] }>({
    '@type': 'searchChatMessages',
    chat_id: Number(chatIdStr),
    topic_id: null,
    query,
    sender_id: null,
    from_message_id: 0,
    offset: 0,
    limit: 100,
    filter: null,
  });
  return res.messages.map((m) => String(m.id));
}

/** Tarixni tozalash (chat ro'yxatda qoladi). */
export async function clearHistory(chatIdStr: string, forAll = false): Promise<void> {
  const chatId = Number(chatIdStr);
  await td({ '@type': 'deleteChatHistory', chat_id: chatId, remove_from_chat_list: false, revoke: forAll });
  if (history.has(chatId)) {
    history.set(chatId, []);
    touchHistory(chatId);
    scheduleFlush();
  }
}

/** Chat qoralamasi matni (draftMessageContentText). */
export function getDraftText(chatIdStr: string): string {
  const d = chats.get(Number(chatIdStr))?.draft_message;
  return d?.content?.['@type'] === 'draftMessageContentText' ? d.content.text?.text ?? '' : '';
}

/** Qoralamani saqlaydi (bo'sh matn — o'chiradi). O'zgarmagan bo'lsa so'rov yuborilmaydi. */
export async function saveDraft(chatIdStr: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (trimmed === getDraftText(chatIdStr).trim()) return;
  await td({
    '@type': 'setChatDraftMessage',
    chat_id: Number(chatIdStr),
    topic_id: null,
    draft_message: trimmed
      ? {
          '@type': 'draftMessage',
          reply_to: null,
          date: 0,
          content: {
            '@type': 'draftMessageContentText',
            text: { '@type': 'formattedText', text, entities: [] },
            link_preview_options: null,
          },
          effect_id: '0',
          suggested_post_info: null,
        }
      : null,
  }).catch(() => undefined);
}

export type InputMode = 'input' | 'mute' | 'join';

/**
 * Pastki panel: kanalda post yozish huquqi bo'lmasa — "Ovozsiz/Ovozni yoqish",
 * a'zo bo'lmagan ochiq chatda — "Qo'shilish".
 */
export async function getInputMode(chatIdStr: string): Promise<{ mode: InputMode; isBroadcast: boolean }> {
  const chat = chats.get(Number(chatIdStr));
  if (!chat) return { mode: 'input', isBroadcast: false };
  const tt = chat.type as TdChat['type'] & { supergroup_id?: number; basic_group_id?: number };
  if (tt['@type'] === 'chatTypeSupergroup' && tt.supergroup_id) {
    let sg = supergroups.get(tt.supergroup_id);
    if (!sg) {
      sg = await td<TdSupergroup & TdObject>({ '@type': 'getSupergroup', supergroup_id: tt.supergroup_id }).catch(() => undefined);
      if (sg) supergroups.set(sg.id, sg);
    }
    if (!sg) return { mode: 'input', isBroadcast: false };
    const st = sg.status['@type'];
    const isMember =
      st === 'chatMemberStatusCreator' ? sg.status.is_member !== false : st !== 'chatMemberStatusLeft' && st !== 'chatMemberStatusBanned' && !(st === 'chatMemberStatusRestricted' && sg.status.is_member === false);
    if (!isMember) return { mode: 'join', isBroadcast: false };
    if (sg.is_channel) {
      if (st === 'chatMemberStatusCreator') return { mode: 'input', isBroadcast: true };
      if (st === 'chatMemberStatusAdministrator' && sg.status.rights?.can_post_messages) return { mode: 'input', isBroadcast: true };
      return { mode: 'mute', isBroadcast: false };
    }
  }
  return { mode: 'input', isBroadcast: false };
}

/** Kanal posti izohlari: muhokama guruhini qaytaradi. */
export async function getDiscussionChat(chatIdStr: string, messageId: string): Promise<Chat | null> {
  const info = await td<TdObject & { chat_id: number; message_thread_id: number }>({
    '@type': 'getMessageThread',
    chat_id: Number(chatIdStr),
    message_id: Number(messageId),
  });
  return chatById(String(info.chat_id));
}

/** Chat obyekti (keshda bo'lmasa getChat). */
export async function chatById(chatIdStr: string): Promise<Chat | null> {
  const id = Number(chatIdStr);
  let chat = chats.get(id);
  if (!chat) {
    chat = await td<TdChat & TdObject>({ '@type': 'getChat', chat_id: id }).catch(() => undefined);
    if (chat) chats.set(chat.id, chat);
  }
  if (!chat) return null;
  if (chat.type.user_id && !users.has(chat.type.user_id)) {
    const user = await td<TdUser & TdObject>({ '@type': 'getUser', user_id: chat.type.user_id }).catch(() => undefined);
    if (user) users.set(user.id, user);
  }
  return toChat(chat);
}

/** @username → chat. */
export async function resolveUsername(username: string): Promise<Chat | null> {
  const chat = await td<TdChat & TdObject>({ '@type': 'searchPublicChat', username: username.replace(/^@/, '') }).catch(
    () => undefined,
  );
  if (!chat) return null;
  if (!chats.has(chat.id)) chats.set(chat.id, chat);
  return chatById(String(chat.id));
}

/**
 * t.me havolasini ilova ichida ochish uchun aniqlaydi.
 * Tanilmasa null — brauzerda ochiladi.
 */
export async function resolveTelegramLink(url: string): Promise<{ chat: Chat; messageId?: string } | null> {
  const link = await td<TdObject & { chat_username?: string }>({ '@type': 'getInternalLinkType', link: url }).catch(() => null);
  if (!link) return null;
  if (link['@type'] === 'internalLinkTypePublicChat' && link.chat_username) {
    const chat = await resolveUsername(link.chat_username);
    return chat ? { chat } : null;
  }
  if (link['@type'] === 'internalLinkTypeMessage') {
    const info = await td<TdObject & { chat_id: number; message?: TdMessage | null }>({ '@type': 'getMessageLinkInfo', url }).catch(
      () => null,
    );
    if (!info?.chat_id) return null;
    const chat = await chatById(String(info.chat_id));
    return chat ? { chat, messageId: info.message ? String(info.message.id) : undefined } : null;
  }
  return null;
}

export interface UserProfile {
  user: UserPreview;
  phone: string;
  bio: string;
  isBlocked: boolean;
  isContact: boolean;
  commonGroups: number;
}

/** Boshqa foydalanuvchi profili (getUser + getUserFullInfo). */
export async function loadUserProfile(userIdStr: string): Promise<UserProfile | null> {
  const id = Number(userIdStr);
  let user = users.get(id);
  if (!user) {
    user = await td<TdUser & TdObject>({ '@type': 'getUser', user_id: id }).catch(() => undefined);
    if (user) users.set(id, user);
  }
  if (!user) return null;
  requestFile(user.profile_photo?.small);
  const full = await td<TdObject & { bio?: TdFormattedText; block_list?: unknown; group_in_common_count?: number }>({
    '@type': 'getUserFullInfo',
    user_id: id,
  }).catch(() => null);
  return {
    user: userPreview(user, userIdStr),
    phone: user.phone_number,
    bio: full?.bio?.text ?? '',
    isBlocked: full?.block_list != null,
    isContact: user.is_contact ?? false,
    commonGroups: full?.group_in_common_count ?? 0,
  };
}

export interface ChatInfo {
  description: string;
  username?: string;
  inviteLink?: string;
  memberCount?: number;
  isMember: boolean;
  isAdmin: boolean;
  linkedChatId?: string;
}

/** Guruh/kanal ma'lumoti (tavsif, havola, a'zolik). */
export async function loadChatInfo(chatIdStr: string): Promise<ChatInfo | null> {
  const chat = chats.get(Number(chatIdStr));
  if (!chat) return null;
  const tt = chat.type as TdChat['type'] & { supergroup_id?: number; basic_group_id?: number };
  if (tt['@type'] === 'chatTypeSupergroup' && tt.supergroup_id) {
    let sg = supergroups.get(tt.supergroup_id);
    if (!sg) {
      sg = await td<TdSupergroup & TdObject>({ '@type': 'getSupergroup', supergroup_id: tt.supergroup_id }).catch(() => undefined);
      if (sg) supergroups.set(sg.id, sg);
    }
    const full = await td<TdObject & { description: string; member_count: number; invite_link?: { invite_link: string } | null; linked_chat_id: number }>({
      '@type': 'getSupergroupFullInfo',
      supergroup_id: tt.supergroup_id,
    }).catch(() => null);
    const st = sg?.status['@type'];
    return {
      description: full?.description ?? '',
      username: sg?.usernames?.active_usernames[0],
      inviteLink: full?.invite_link?.invite_link,
      memberCount: full?.member_count || sg?.member_count || undefined,
      isMember: st !== undefined && st !== 'chatMemberStatusLeft' && st !== 'chatMemberStatusBanned',
      isAdmin: st === 'chatMemberStatusCreator' || st === 'chatMemberStatusAdministrator',
      linkedChatId: full?.linked_chat_id ? String(full.linked_chat_id) : undefined,
    };
  }
  if (tt['@type'] === 'chatTypeBasicGroup' && tt.basic_group_id) {
    const full = await td<TdObject & { description: string; members: unknown[]; invite_link?: { invite_link: string } | null }>({
      '@type': 'getBasicGroupFullInfo',
      basic_group_id: tt.basic_group_id,
    }).catch(() => null);
    const st = basicGroupStatus.get(tt.basic_group_id);
    return {
      description: full?.description ?? '',
      inviteLink: full?.invite_link?.invite_link,
      memberCount: basicGroupCounts.get(tt.basic_group_id) ?? full?.members.length,
      isMember: st !== 'chatMemberStatusLeft' && st !== 'chatMemberStatusBanned',
      isAdmin: st === 'chatMemberStatusCreator' || st === 'chatMemberStatusAdministrator',
    };
  }
  return null;
}

/** Guruh adminlari: userId → 'owner' | 'admin' (+ maxsus unvon). */
export async function loadAdmins(chatIdStr: string): Promise<Map<string, { owner: boolean; title: string }>> {
  const out = new Map<string, { owner: boolean; title: string }>();
  const res = await td<TdObject & { administrators: { user_id: number; custom_title: string; is_owner: boolean }[] }>({
    '@type': 'getChatAdministrators',
    chat_id: Number(chatIdStr),
  }).catch(() => null);
  for (const a of res?.administrators ?? []) out.set(String(a.user_id), { owner: a.is_owner, title: a.custom_title });
  return out;
}

export interface SharedMediaCounts {
  media: number;
  files: number;
  links: number;
  voice: number;
  audio: number;
}

/** Chatdagi umumiy media sonlari (serverdan). */
export async function loadSharedMediaCounts(chatIdStr: string): Promise<SharedMediaCounts> {
  const count = (filter: string) =>
    td<TdObject & { count: number }>({
      '@type': 'getChatMessageCount',
      chat_id: Number(chatIdStr),
      topic_id: null,
      filter: { '@type': filter },
      return_local: false,
    })
      .then((r) => r.count)
      .catch(() => 0);
  const [media, files, links, voice, audio] = await Promise.all([
    count('searchMessagesFilterPhotoAndVideo'),
    count('searchMessagesFilterDocument'),
    count('searchMessagesFilterUrl'),
    count('searchMessagesFilterVoiceNote'),
    count('searchMessagesFilterAudio'),
  ]);
  return { media, files, links, voice, audio };
}

/** Telegram kontaktlari (getContacts) — ism bo'yicha tartiblangan. */
export async function loadContacts(): Promise<UserPreview[]> {
  const res = await td<TdObject & { user_ids: number[] }>({ '@type': 'getContacts' });
  const list: UserPreview[] = [];
  for (const id of res.user_ids) {
    let user = users.get(id);
    if (!user) {
      user = await td<TdUser & TdObject>({ '@type': 'getUser', user_id: id }).catch(() => undefined);
      if (user) users.set(id, user);
    }
    requestFile(user?.profile_photo?.small);
    list.push(userPreview(user, String(id)));
  }
  return list.sort((a, b) => a.firstName.localeCompare(b.firstName));
}

/** Foydalanuvchi bilan shaxsiy chatni ochadi (bo'lmasa yaratadi). */
export async function openPrivateChat(userId: string): Promise<Chat> {
  const chat = await td<TdChat & TdObject>({
    '@type': 'createPrivateChat',
    user_id: Number(userId),
    force: false,
  });
  chats.set(chat.id, { ...chat, ...chats.get(chat.id) });
  return toChat(chats.get(chat.id)!);
}

/** Global qidiruv: avval keshdagi chatlar, keyin Telegram serveri. */
export async function searchChats(query: string): Promise<Chat[]> {
  const [local, remote] = await Promise.all([
    td<TdObject & { chat_ids: number[] }>({ '@type': 'searchChats', query, limit: 20 }).catch(() => ({ chat_ids: [] })),
    td<TdObject & { chat_ids: number[] }>({ '@type': 'searchPublicChats', query }).catch(() => ({ chat_ids: [] })),
  ]);
  const ids = [...new Set([...local.chat_ids, ...remote.chat_ids])];
  const result: Chat[] = [];
  for (const id of ids) {
    let chat = chats.get(id);
    if (!chat) {
      chat = await td<TdChat & TdObject>({ '@type': 'getChat', chat_id: id }).catch(() => undefined);
      if (chat) chats.set(id, chat);
    }
    if (chat) {
      const uid = chat.type.user_id;
      const sg = (chat.type as { supergroup_id?: number }).supergroup_id;
      if (sg && !supergroupCounts.has(sg)) {
        const g = await td<TdObject & { member_count: number }>({ '@type': 'getSupergroup', supergroup_id: sg }).catch(() => undefined);
        if (g?.member_count) supergroupCounts.set(sg, g.member_count);
      }
      if (uid && !users.has(uid)) {
        const user = await td<TdUser & TdObject>({ '@type': 'getUser', user_id: uid }).catch(() => undefined);
        if (user) users.set(uid, user);
      }
      result.push(toChat(chat));
    }
  }
  return result;
}

/** Barcha chatlardagi xabarlar bo'yicha qidiruv (server). */
export async function searchMessages(query: string): Promise<ChatMessage[]> {
  const res = await td<TdObject & { messages: TdMessage[] }>({
    '@type': 'searchMessages',
    query,
    limit: 30,
    offset: '',
  }).catch(() => ({ messages: [] as TdMessage[] }));
  return res.messages.map(toChatMessage);
}

export function chatName(chatIdStr: string): string {
  return chats.get(Number(chatIdStr))?.title ?? '';
}

async function previewOfUserId(id: number): Promise<UserPreview> {
  let user = users.get(id);
  if (!user) {
    user = await td<TdUser & TdObject>({ '@type': 'getUser', user_id: id }).catch(() => undefined);
    if (user) users.set(id, user);
  }
  requestFile(user?.profile_photo?.small);
  return userPreview(user, String(id));
}

/** Guruh a'zolari (oddiy guruh — hammasi, superguruh — birinchi 50 ta). */
export async function loadMembers(chatIdStr: string): Promise<UserPreview[]> {
  const chat = chats.get(Number(chatIdStr));
  if (!chat) return [];
  const type = chat.type as TdChat['type'] & { basic_group_id?: number; supergroup_id?: number };
  let ids: number[] = [];
  if (type['@type'] === 'chatTypeBasicGroup' && type.basic_group_id) {
    const info = await td<TdObject & { members: { member_id: { user_id?: number } }[] }>({
      '@type': 'getBasicGroupFullInfo',
      basic_group_id: type.basic_group_id,
    });
    ids = info.members.map((m) => m.member_id.user_id ?? 0).filter(Boolean);
  } else if (type['@type'] === 'chatTypeSupergroup' && type.supergroup_id) {
    const res = await td<TdObject & { members: { member_id: { user_id?: number } }[] }>({
      '@type': 'getSupergroupMembers',
      supergroup_id: type.supergroup_id,
      filter: null,
      offset: 0,
      limit: 50,
    });
    ids = res.members.map((m) => m.member_id.user_id ?? 0).filter(Boolean);
  }
  return Promise.all(ids.map(previewOfUserId));
}

export async function loadBlockedUsers(): Promise<UserPreview[]> {
  const res = await td<TdObject & { senders: { '@type': string; user_id?: number }[] }>({
    '@type': 'getBlockedMessageSenders',
    block_list: { '@type': 'blockListMain' },
    offset: 0,
    limit: 100,
  });
  const ids = res.senders.map((s) => s.user_id ?? 0).filter(Boolean);
  return Promise.all(ids.map(previewOfUserId));
}

export async function setUserBlocked(userId: string, blocked: boolean): Promise<void> {
  await td({
    '@type': 'setMessageSenderBlockList',
    sender_id: { '@type': 'messageSenderUser', user_id: Number(userId) },
    block_list: blocked ? { '@type': 'blockListMain' } : null,
  });
}

export async function setChatJoined(chatIdStr: string, joined: boolean): Promise<void> {
  await td({ '@type': joined ? 'joinChat' : 'leaveChat', chat_id: Number(chatIdStr) });
}

export async function setChatMuted(chatIdStr: string, muted: boolean): Promise<void> {
  await td({
    '@type': 'setChatNotificationSettings',
    chat_id: Number(chatIdStr),
    notification_settings: {
      '@type': 'chatNotificationSettings',
      use_default_mute_for: false,
      mute_for: muted ? 2147483647 : 0,
      // Qolgan sozlamalar umumiy (default) qiymatda qoladi.
      use_default_sound: true,
      use_default_show_preview: true,
      use_default_mute_stories: true,
      use_default_story_sound: true,
      use_default_show_story_poster: true,
      use_default_disable_pinned_message_notifications: true,
      use_default_disable_mention_notifications: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Chat ro'yxatidagi amallar (uzoq bosish menyusi)
// ---------------------------------------------------------------------------

export async function setChatPinned(chatIdStr: string, key: string, pinned: boolean): Promise<void> {
  await td({ '@type': 'toggleChatIsPinned', chat_list: tdList(key), chat_id: Number(chatIdStr), is_pinned: pinned });
}

export async function setChatArchived(chatIdStr: string, archived: boolean): Promise<void> {
  await td({
    '@type': 'addChatToList',
    chat_id: Number(chatIdStr),
    chat_list: archived ? { '@type': 'chatListArchive' } : { '@type': 'chatListMain' },
  });
}

/** Chatdagi oxirgi xabarni o'qilgan deb belgilaydi (Telegram'dagi "O'qilgan deb belgilash"). */
export async function markChatRead(chatIdStr: string): Promise<void> {
  const chat = chats.get(Number(chatIdStr));
  const last = chat?.last_message?.id;
  if (last) {
    await td({ '@type': 'viewMessages', chat_id: Number(chatIdStr), message_ids: [last], force_read: true });
  }
  await td({ '@type': 'toggleChatIsMarkedAsUnread', chat_id: Number(chatIdStr), is_marked_as_unread: false }).catch(
    () => undefined,
  );
}

/** Shaxsiy chat — tarixni o'chiradi; guruh/kanal — chiqib ketadi. */
export async function deleteChat(chatIdStr: string): Promise<void> {
  const chat = chats.get(Number(chatIdStr));
  const tt = chat?.type['@type'];
  if (tt === 'chatTypeBasicGroup' || tt === 'chatTypeSupergroup') {
    await td({ '@type': 'leaveChat', chat_id: Number(chatIdStr) });
  }
  await td({ '@type': 'deleteChatHistory', chat_id: Number(chatIdStr), remove_from_chat_list: true, revoke: false });
}
