/**
 * TDLib JSON obyektlarining ilovada ishlatiladigan qismi.
 * To'liq sxema: https://core.telegram.org/tdlib/docs/td__api_8h.html
 * (TDLib int64 qiymatlarni JSON'da ham son, ham satr ko'rinishida beradi —
 * `order` kabi int64 maydonlar satr sifatida keladi.)
 */

export interface TdObject {
  '@type': string;
  '@extra'?: string;
  [key: string]: unknown;
}

export interface TdFile {
  id: number;
  local: { path: string; is_downloading_completed: boolean };
}

export interface TdChatPhotoInfo {
  small: TdFile;
}

export interface TdFormattedText {
  text: string;
}

export interface TdMessageSender {
  '@type': 'messageSenderUser' | 'messageSenderChat';
  user_id?: number;
  chat_id?: number;
}

export interface TdMessageContent {
  '@type': string;
  text?: TdFormattedText;
  caption?: TdFormattedText;
  emoji?: string;
  sticker?: { emoji?: string };
  document?: { file_name?: string };
  audio?: { title?: string };
}

export interface TdReaction {
  type: { '@type': string; emoji?: string };
  total_count: number;
  is_chosen: boolean;
}

export interface TdInteractionInfo {
  reactions?: { reactions: TdReaction[] };
}

export interface TdMessage {
  '@type': 'message';
  id: number;
  chat_id: number;
  sender_id: TdMessageSender;
  is_outgoing: boolean;
  date: number;
  edit_date: number;
  content: TdMessageContent;
  is_pinned?: boolean;
  interaction_info?: TdInteractionInfo;
  sending_state?: { '@type': 'messageSendingStatePending' | 'messageSendingStateFailed' };
}

export interface TdChatPosition {
  list: { '@type': string };
  order: string;
  is_pinned: boolean;
}

export interface TdChat {
  '@type': 'chat';
  id: number;
  type: {
    '@type': 'chatTypePrivate' | 'chatTypeSecret' | 'chatTypeBasicGroup' | 'chatTypeSupergroup';
    user_id?: number;
    is_channel?: boolean;
  };
  title: string;
  photo?: TdChatPhotoInfo;
  last_message?: TdMessage;
  positions: TdChatPosition[];
  unread_count: number;
  last_read_outbox_message_id: number;
  notification_settings: { mute_for: number };
  is_marked_as_unread?: boolean;
}

export interface TdUser {
  '@type': 'user';
  id: number;
  first_name: string;
  last_name: string;
  usernames?: { active_usernames: string[] };
  phone_number: string;
  status: { '@type': string };
  profile_photo?: { small: TdFile };
  verification_status?: unknown;
  type: { '@type': string };
}

export type TdAuthState =
  | 'loading'
  | 'waitPhoneNumber'
  | 'waitCode'
  | 'waitPassword'
  | 'waitRegistration'
  | 'waitOther'
  | 'ready'
  | 'loggingOut'
  | 'closed';
