/**
 * Chatlar va xabarlar sinxronizatsiyasi: TDLib update'laridan lokal kesh
 * (chat/user obyektlari) yig'iladi va UI uchun useChatStore'ga yoziladi.
 *
 * Ghost mode (3-faza) uchun: o'qilgan belgisi faqat `markRead` orqali
 * yuboriladi — boshqa joyda viewMessages chaqirilmaydi.
 */
import { useChatStore, type Chat, type ChatMessage, type UserPreview } from '@/stores/chat.store';
import { onTdUpdate, td } from './client';
import { fileUri, onFilesChanged, requestFile } from './files';
import type { TdChat, TdMessage, TdObject, TdUser } from './types';

const chats = new Map<number, TdChat>();
const users = new Map<number, TdUser>();
/** Ochilgan chatlarning xabarlari (eskidan yangiga). */
const history = new Map<number, TdMessage[]>();
/** Guruh/kanal a'zolari soni: basic_group_id / supergroup_id bo'yicha. */
const basicGroupCounts = new Map<number, number>();
const supergroupCounts = new Map<number, number>();

let unsubscribe: (() => void) | null = null;
let unsubscribeFiles: (() => void) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const dirtyHistory = new Set<number>();

// ---------------------------------------------------------------------------
// TDLib → UI modeli
// ---------------------------------------------------------------------------

function mainPosition(chat: TdChat) {
  return chat.positions.find((p) => p.list['@type'] === 'chatListMain');
}

/** int64 satrlarni taqqoslash (order) — BigInt'siz: avval uzunlik, keyin leksik. */
function compareOrderDesc(a: string, b: string): number {
  if (a.length !== b.length) return b.length - a.length;
  return a < b ? 1 : a > b ? -1 : 0;
}

function userName(u: TdUser | undefined): string {
  if (!u) return '';
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || "O'chirilgan akkaunt";
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
  return {
    id: u ? String(u.id) : fallbackId,
    firstName: u?.first_name || userName(u) || '',
    lastName: u?.last_name || undefined,
    username: u?.usernames?.active_usernames[0],
    avatarUrl: fileUri(u?.profile_photo?.small),
    status: userStatus(u),
    isVerified: false,
  };
}

/** Matnsiz xabar turlari uchun qisqa yozuv (media 2-fazada to'liq ko'rsatiladi). */
function contentText(m: TdMessage): string {
  const c = m.content;
  const caption = c.caption?.text ? ` ${c.caption.text}` : '';
  switch (c['@type']) {
    case 'messageText':
      return c.text?.text ?? '';
    case 'messagePhoto':
      return `📷 Rasm${caption}`;
    case 'messageVideo':
      return `🎬 Video${caption}`;
    case 'messageAnimation':
      return `GIF${caption}`;
    case 'messageVoiceNote':
      return '🎤 Ovozli xabar';
    case 'messageVideoNote':
      return '⏺ Video xabar';
    case 'messageAudio':
      return `🎵 ${c.audio?.title ?? 'Audio'}`;
    case 'messageDocument':
      return `📎 ${c.document?.file_name ?? 'Fayl'}${caption}`;
    case 'messageSticker':
      return `${c.sticker?.emoji ?? ''} Stiker`.trim();
    case 'messageAnimatedEmoji':
      return c.emoji ?? '';
    case 'messageContact':
      return '👤 Kontakt';
    case 'messageLocation':
    case 'messageVenue':
      return '📍 Joylashuv';
    case 'messagePoll':
      return "📊 So'rovnoma";
    case 'messageCall':
      return "📞 Qo'ng'iroq";
    default:
      return 'Xizmat xabari';
  }
}

function senderOf(m: TdMessage): { id: string; preview: UserPreview } {
  if (m.is_outgoing) {
    return { id: 'me', preview: userPreview(undefined, 'me') };
  }
  if (m.sender_id['@type'] === 'messageSenderUser' && m.sender_id.user_id) {
    const u = users.get(m.sender_id.user_id);
    return { id: String(m.sender_id.user_id), preview: userPreview(u, String(m.sender_id.user_id)) };
  }
  const chat = m.sender_id.chat_id ? chats.get(m.sender_id.chat_id) : undefined;
  const id = String(m.sender_id.chat_id ?? m.chat_id);
  return {
    id,
    preview: { id, firstName: chat?.title ?? '', status: 'offline', isVerified: false, avatarUrl: fileUri(chat?.photo?.small) },
  };
}

type AnyFile = { id: number; size?: number; expected_size?: number; local: { path: string; is_downloading_completed: boolean } };
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

/** Xabar kontentidan media maydonlari (rasm, video, ovoz, fayl, stiker). */
function mediaFields(m: TdMessage): Partial<ChatMessage> {
  const c = m.content as unknown as Record<string, any>;
  const caption = (c.caption?.text as string | undefined) || undefined;
  switch (c['@type']) {
    case 'messagePhoto': {
      const sizes = (c.photo?.sizes ?? []) as { type: string; width: number; height: number; photo: AnyFile }[];
      // Ekran uchun ~1280px dan oshmaydigan eng kattasi.
      const best = [...sizes].filter((x) => x.width <= 1280).pop() ?? sizes[sizes.length - 1];
      return {
        type: 'image',
        mediaKind: 'photo',
        text: caption,
        mediaUrl: fileOrRequest(best?.photo),
        thumbUrl: miniUri(c.photo?.minithumbnail),
        mediaWidth: best?.width,
        mediaHeight: best?.height,
        mediaFileId: best?.photo.id,
      };
    }
    case 'messageVideo':
    case 'messageAnimation':
    case 'messageVideoNote': {
      const v = c.video ?? c.animation ?? c.video_note;
      const kind = c['@type'] === 'messageVideo' ? 'video' : c['@type'] === 'messageAnimation' ? 'gif' : 'videoNote';
      const file = (v?.video ?? v?.animation) as AnyFile | undefined;
      return {
        type: 'video',
        mediaKind: kind,
        text: caption,
        thumbUrl: fileOrRequest(v?.thumbnail?.file) ?? miniUri(v?.minithumbnail),
        mediaWidth: v?.width ?? v?.length,
        mediaHeight: v?.height ?? v?.length,
        duration: v?.duration,
        mediaFileId: file?.id,
        fileSize: file?.size || file?.expected_size,
      };
    }
    case 'messageVoiceNote': {
      const vn = c.voice_note;
      return {
        type: 'voice',
        text: caption,
        duration: vn?.duration,
        waveform: decodeWaveform(vn?.waveform),
        mediaFileId: vn?.voice?.id,
      };
    }
    case 'messageAudio': {
      const au = c.audio;
      return {
        type: 'audio',
        text: caption,
        fileName: [au?.performer, au?.title].filter(Boolean).join(' — ') || au?.file_name || 'Audio',
        duration: au?.duration,
        mediaFileId: au?.audio?.id,
        fileSize: au?.audio?.size,
      };
    }
    case 'messageDocument': {
      const d = c.document;
      return {
        type: 'document',
        text: caption,
        fileName: d?.file_name || 'Fayl',
        fileSize: d?.document?.size || d?.document?.expected_size,
        mediaFileId: d?.document?.id,
        thumbUrl: miniUri(d?.minithumbnail),
      };
    }
    case 'messageSticker': {
      const st = c.sticker;
      // Animatsiyali (tgs/webm) stikerlar uchun hozircha statik thumbnail.
      const isStatic = st?.format?.['@type'] === 'stickerFormatWebp';
      const uri = isStatic ? fileOrRequest(st?.sticker) : fileOrRequest(st?.thumbnail?.file);
      if (!uri && !st?.thumbnail) return { type: 'text', text: st?.emoji ?? 'Stiker' };
      return {
        type: 'image',
        mediaKind: 'sticker',
        mediaUrl: uri,
        mediaWidth: st?.width,
        mediaHeight: st?.height,
      };
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
  return {
    id: String(m.id),
    chatId: String(m.chat_id),
    senderId: sender.id,
    senderPreview: sender.preview,
    type: 'text',
    text: contentText(m),
    previewText: contentText(m),
    ...mediaFields(m),
    status,
    sentAt: new Date(m.date * 1000),
    editedAt: m.edit_date ? new Date(m.edit_date * 1000) : undefined,
    isDeleted: false,
    isPinned: m.is_pinned ?? false,
    replyTo: null,
    reactions: (m.interaction_info?.reactions?.reactions ?? [])
      .filter((r) => r.type['@type'] === 'reactionTypeEmoji' && r.type.emoji)
      .map((r) => ({
        emoji: r.type.emoji!,
        count: r.total_count,
        userIds: r.is_chosen ? ['me'] : [],
        hasCurrentUser: r.is_chosen,
      })),
  };
}

function toChat(c: TdChat): Chat {
  const pos = mainPosition(c);
  let type: Chat['type'] = 'private';
  let otherUser: UserPreview | undefined;
  if (c.type['@type'] === 'chatTypeBasicGroup') type = 'group';
  if (c.type['@type'] === 'chatTypeSupergroup') type = c.type.is_channel ? 'channel' : 'group';
  if (c.type.user_id) {
    otherUser = userPreview(users.get(c.type.user_id), String(c.type.user_id));
  }
  const t = c.type as TdChat['type'] & { basic_group_id?: number; supergroup_id?: number };
  const count = t.basic_group_id
    ? basicGroupCounts.get(t.basic_group_id)
    : t.supergroup_id
    ? supergroupCounts.get(t.supergroup_id)
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
    isArchived: false,
    otherUser,
    memberCount: count || undefined,
    isOnline: otherUser?.status === 'online',
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

function flush(): void {
  flushTimer = null;
  const list = [...chats.values()]
    .filter((c) => {
      const p = mainPosition(c);
      return p !== undefined && p.order !== '0';
    })
    .sort((a, b) => compareOrderDesc(mainPosition(a)!.order, mainPosition(b)!.order))
    .map(toChat);
  const store = useChatStore.getState();
  store.setChats(list);
  dirtyHistory.forEach((chatId) => {
    store.setMessages(String(chatId), (history.get(chatId) ?? []).map(toChatMessage));
  });
  dirtyHistory.clear();
}

function touchHistory(chatId: number): void {
  if (history.has(chatId)) dirtyHistory.add(chatId);
}

function updateChat(chatId: number, patch: Partial<TdChat>): void {
  const chat = chats.get(chatId);
  if (!chat) return;
  chats.set(chatId, { ...chat, ...patch });
}

function setPosition(chatId: number, position: TdChat['positions'][number]): void {
  const chat = chats.get(chatId);
  if (!chat) return;
  const others = chat.positions.filter((p) => p.list['@type'] !== position.list['@type']);
  chats.set(chatId, { ...chat, positions: position.order === '0' ? others : [...others, position] });
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
      updateChat(u.chat_id as number, { unread_count: u.unread_count as number });
      break;
    case 'updateChatReadOutbox':
      updateChat(u.chat_id as number, {
        last_read_outbox_message_id: u.last_read_outbox_message_id as number,
      });
      touchHistory(u.chat_id as number);
      break;
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
    case 'updateBasicGroup': {
      const g = u.basic_group as { id: number; member_count: number };
      basicGroupCounts.set(g.id, g.member_count);
      break;
    }
    case 'updateSupergroup': {
      const g = u.supergroup as { id: number; member_count: number };
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
      const list = history.get(u.chat_id as number);
      const m = list?.find((x) => x.id === (u.message_id as number));
      if (m) {
        m.content = u.new_content as TdMessage['content'];
        touchHistory(m.chat_id);
      }
      break;
    }
    case 'updateMessageInteractionInfo': {
      const list = history.get(u.chat_id as number);
      const m = list?.find((x) => x.id === (u.message_id as number));
      if (m) {
        m.interaction_info = u.interaction_info as TdMessage['interaction_info'];
        touchHistory(m.chat_id);
      }
      break;
    }
    case 'updateMessageIsPinned': {
      const list = history.get(u.chat_id as number);
      const m = list?.find((x) => x.id === (u.message_id as number));
      if (m) {
        m.is_pinned = u.is_pinned as boolean;
        touchHistory(m.chat_id);
      }
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
      break;
    }
    default:
      return;
  }
  scheduleFlush();
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
  void loadMoreChats();
}

export function stopChatSync(): void {
  chats.clear();
  users.clear();
  history.clear();
  useChatStore.getState().setChats([]);
}

/** Asosiy ro'yxatdan yana chat yuklaydi; hammasi yuklangan bo'lsa false. */
export async function loadMoreChats(limit = 50): Promise<boolean> {
  useChatStore.setState({ isLoadingChats: true });
  try {
    await td({ '@type': 'loadChats', chat_list: { '@type': 'chatListMain' }, limit });
    return true;
  } catch {
    // 404 — ro'yxat oxiriga yetildi.
    return false;
  } finally {
    useChatStore.setState({ isLoadingChats: false });
  }
}

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
      limit: wanted,
      only_local: false,
    });
    const older = res.messages.filter((m): m is TdMessage => m !== null);
    if (older.length === 0) break;
    const known = new Set(list.map((m) => m.id));
    // TDLib yangidan eskiga qaytaradi; bizda eskidan yangiga.
    list.unshift(...older.filter((m) => !known.has(m.id)).reverse());
    fromId = list[0]!.id;
  }
  dirtyHistory.add(chatId);
  flush();
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

export async function sendText(chatIdStr: string, text: string, replyToId?: string): Promise<void> {
  const chatId = Number(chatIdStr);
  const sent = await td<TdMessage & TdObject>({
    '@type': 'sendMessage',
    chat_id: chatId,
    reply_to: replyToId
      ? { '@type': 'inputMessageReplyToMessage', message_id: Number(replyToId) }
      : undefined,
    input_message_content: {
      '@type': 'inputMessageText',
      text: { '@type': 'formattedText', text },
    },
  });
  const list = history.get(chatId);
  if (list && !list.some((x) => x.id === sent.id)) {
    list.push(sent);
    dirtyHistory.add(chatId);
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
