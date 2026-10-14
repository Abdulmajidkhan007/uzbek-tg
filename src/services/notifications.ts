/**
 * Mahalliy bildirishnomalar: TDLib updateNewMessage → AppNative.showNotification.
 * Ilova jarayoni ishlab turganda (fonda ham) ishlaydi; ilova butunlay
 * yopilganda push uchun Firebase kerak (hozircha yo'q).
 *
 *   startNotifications()      // avtorizatsiya 'ready' bo'lganda
 *   stopNotifications()       // chiqishda
 *   setOpenChat(chatId|null)  // chat ekrani ochilganda / yopilganda
 *   consumeLaunchChat()       // ilova bildirishnomadan ochilgan bo'lsa — chat id
 */
import { AppState } from 'react-native';
import { onTdUpdate, td } from '@/services/tdlib/client';
import type { TdObject } from '@/services/tdlib/types';
import { AppNative } from '@/services/native';
import { useUIStore } from '@/stores/ui.store';
import { t } from '@/i18n';
import { getScopeSettings, type NotifScope, type ScopeSettings } from '@/services/tdlib/settings';

interface ChatNotif {
  use_default_mute_for: boolean;
  mute_for: number;
  use_default_show_preview: boolean;
  show_preview: boolean;
  use_default_disable_pinned_message_notifications: boolean;
  disable_pinned_message_notifications: boolean;
}

interface CachedChat {
  title: string;
  scope: NotifScope;
  settings: ChatNotif;
  lastReadInbox: number;
}

interface TdChatFull extends TdObject {
  id: number;
  title: string;
  type: { '@type': string; is_channel?: boolean };
  notification_settings: ChatNotif;
  last_read_inbox_message_id: number;
}

interface TdNewMessage {
  id: number;
  chat_id: number;
  is_outgoing: boolean;
  sender_id: { '@type': string; user_id?: number; chat_id?: number };
  content: {
    '@type': string;
    text?: { text: string };
    caption?: { text: string };
    sticker?: { emoji?: string };
    document?: { file_name?: string };
    audio?: { title?: string; performer?: string };
    poll?: { question?: { text: string } };
    contact?: { first_name?: string; last_name?: string };
  };
}

const chats = new Map<string, CachedChat>();
const userNames = new Map<number, string>();
const scopes: Partial<Record<NotifScope, ScopeSettings>> = {};
let unsubscribe: (() => void) | null = null;
let openChatId: string | null = null;

/** Chat ekrani ochilganda id beriladi, yopilganda null. */
export function setOpenChat(chatId: string | null): void {
  openChatId = chatId;
  if (chatId) AppNative?.cancelNotification?.(notificationId(chatId));
}

/** Har bir chat uchun bitta bildirishnoma (yangisi eskisini almashtiradi). */
export function notificationId(chatId: string): number {
  let h = 0;
  for (let i = 0; i < chatId.length; i++) h = (Math.imul(h, 31) + chatId.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647 || 1;
}

function scopeOf(type: TdChatFull['type']): NotifScope {
  if (type['@type'] === 'chatTypePrivate' || type['@type'] === 'chatTypeSecret') return 'private';
  if (type['@type'] === 'chatTypeSupergroup' && type.is_channel) return 'channel';
  return 'group';
}

function cacheChat(chat: TdChatFull): CachedChat {
  const entry: CachedChat = {
    title: chat.title,
    scope: scopeOf(chat.type),
    settings: chat.notification_settings,
    lastReadInbox: chat.last_read_inbox_message_id ?? 0,
  };
  chats.set(String(chat.id), entry);
  return entry;
}

async function getCachedChat(chatId: string): Promise<CachedChat | null> {
  const hit = chats.get(chatId);
  if (hit) return hit;
  try {
    return cacheChat(await td<TdChatFull>({ '@type': 'getChat', chat_id: Number(chatId) }));
  } catch {
    return null;
  }
}

async function userName(userId: number): Promise<string> {
  const hit = userNames.get(userId);
  if (hit) return hit;
  try {
    const u = await td<TdObject & { first_name: string; last_name: string }>({ '@type': 'getUser', user_id: userId });
    const name = `${u.first_name}${u.last_name ? ` ${u.last_name}` : ''}`.trim();
    userNames.set(userId, name);
    return name;
  } catch {
    return '';
  }
}

function isMuted(chat: CachedChat): boolean {
  const s = chat.settings;
  if (s.use_default_mute_for) return (scopes[chat.scope]?.mute_for ?? 0) > 0;
  return s.mute_for > 0;
}

function showsPreview(chat: CachedChat): boolean {
  const s = chat.settings;
  if (s.use_default_show_preview) return scopes[chat.scope]?.show_preview ?? true;
  return s.show_preview;
}

function pinnedDisabled(chat: CachedChat): boolean {
  const s = chat.settings;
  if (s.use_default_disable_pinned_message_notifications) {
    return scopes[chat.scope]?.disable_pinned_message_notifications ?? false;
  }
  return s.disable_pinned_message_notifications;
}

/** Xabar mazmunining qisqa matni (media uchun tarjima qilingan yorliq). */
function previewText(content: TdNewMessage['content']): string {
  const caption = content.caption?.text?.trim();
  const withCaption = (label: string) => (caption ? `${label}, ${caption}` : label);
  switch (content['@type']) {
    case 'messageText':
      return content.text?.text ?? '';
    case 'messagePhoto':
      return withCaption(t('settings.notif.photo'));
    case 'messageVideo':
      return withCaption(t('settings.notif.video'));
    case 'messageAnimation':
      return withCaption(t('settings.notif.gif'));
    case 'messageVoiceNote':
      return withCaption(t('settings.notif.voice'));
    case 'messageVideoNote':
      return t('settings.notif.videoNote');
    case 'messageSticker':
      return `${content.sticker?.emoji ? `${content.sticker.emoji} ` : ''}${t('settings.notif.sticker')}`;
    case 'messageDocument':
      return withCaption(content.document?.file_name || t('settings.notif.file'));
    case 'messageAudio':
      return withCaption(content.audio?.title || t('settings.notif.audio'));
    case 'messageLocation':
    case 'messageVenue':
      return t('settings.notif.location');
    case 'messageContact':
      return t('settings.notif.contact');
    case 'messagePoll':
      return `📊 ${content.poll?.question?.text ?? t('settings.notif.poll')}`;
    case 'messageCall':
      return t('settings.notif.call');
    default:
      return t('settings.notif.newMessage');
  }
}

async function handleNewMessage(m: TdNewMessage): Promise<void> {
  const prefs = useUIStore.getState();
  if (!prefs.notificationsEnabled || m.is_outgoing) return;
  const chatId = String(m.chat_id);
  const appActive = AppState.currentState === 'active';
  if (appActive && openChatId === chatId) return;

  const chat = await getCachedChat(chatId);
  if (!chat || isMuted(chat)) return;
  // Allaqachon o'qilgan (masalan, boshqa qurilmada) xabar.
  if (m.id <= chat.lastReadInbox) return;
  if (m.content['@type'] === 'messagePinMessage' && pinnedDisabled(chat)) return;

  let title = chat.title;
  if (chat.scope === 'group' && m.sender_id['@type'] === 'messageSenderUser' && m.sender_id.user_id) {
    const sender = await userName(m.sender_id.user_id);
    if (sender) title = `${sender} @ ${chat.title}`;
  }

  // Ilova ochiq bo'lsa "ilova ichidagi" sozlamalar ham hisobga olinadi.
  const preview = showsPreview(chat) && (!appActive || prefs.inAppPreview);
  const body = preview ? previewText(m.content) || t('settings.notif.newMessage') : t('settings.notif.newMessage');
  const silent = appActive && !prefs.inAppSounds && !prefs.inAppVibrate;

  AppNative?.showNotification?.(notificationId(chatId), chatId, title, body, silent);
}

function handleUpdate(u: TdObject): void {
  switch (u['@type']) {
    case 'updateNewMessage':
      void handleNewMessage(u.message as TdNewMessage);
      break;
    case 'updateNewChat':
      cacheChat(u.chat as TdChatFull);
      break;
    case 'updateChatTitle': {
      const c = chats.get(String(u.chat_id));
      if (c) c.title = String(u.title);
      break;
    }
    case 'updateChatNotificationSettings': {
      const c = chats.get(String(u.chat_id));
      if (c) c.settings = u.notification_settings as ChatNotif;
      break;
    }
    case 'updateScopeNotificationSettings': {
      const type = (u.scope as TdObject)['@type'];
      const scope: NotifScope | null =
        type === 'notificationSettingsScopePrivateChats'
          ? 'private'
          : type === 'notificationSettingsScopeGroupChats'
          ? 'group'
          : type === 'notificationSettingsScopeChannelChats'
          ? 'channel'
          : null;
      if (scope) scopes[scope] = u.notification_settings as ScopeSettings;
      break;
    }
    case 'updateChatReadInbox': {
      const chatId = String(u.chat_id);
      const c = chats.get(chatId);
      if (c) c.lastReadInbox = Number(u.last_read_inbox_message_id);
      if (Number(u.unread_count) === 0) AppNative?.cancelNotification?.(notificationId(chatId));
      break;
    }
    default:
      break;
  }
}

/** Takroriy chaqiruv xavfsiz. */
export function startNotifications(): void {
  if (unsubscribe) return;
  unsubscribe = onTdUpdate(handleUpdate);
  for (const scope of ['private', 'group', 'channel'] as NotifScope[]) {
    getScopeSettings(scope)
      .then((s) => {
        scopes[scope] = s;
      })
      .catch(() => undefined);
  }
}

export function stopNotifications(): void {
  unsubscribe?.();
  unsubscribe = null;
  chats.clear();
  userNames.clear();
  openChatId = null;
  for (const k of Object.keys(scopes)) delete scopes[k as NotifScope];
  AppNative?.cancelAllNotifications?.();
}

/** Ilova bildirishnoma bosilib ochilgan bo'lsa — chat id (bir marta). */
export async function consumeLaunchChat(): Promise<string | null> {
  try {
    return (await AppNative?.getLaunchChatId?.()) ?? null;
  } catch {
    return null;
  }
}
