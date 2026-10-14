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
  size?: number;
  expected_size?: number;
  local: {
    path: string;
    is_downloading_completed: boolean;
    is_downloading_active?: boolean;
    downloaded_size?: number;
  };
  remote?: { is_uploading_active?: boolean; is_uploading_completed?: boolean; uploaded_size?: number };
}

export interface TdChatPhotoInfo {
  small: TdFile;
}

export interface TdTextEntity {
  offset: number;
  length: number;
  type: { '@type': string; url?: string; user_id?: number; language?: string };
}

export interface TdFormattedText {
  text: string;
  entities?: TdTextEntity[];
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
  view_count?: number;
  forward_count?: number;
  reply_info?: { reply_count: number; last_message_id?: number } | null;
  reactions?: { reactions: TdReaction[] };
}

export type TdMessageOrigin =
  | { '@type': 'messageOriginUser'; sender_user_id: number }
  | { '@type': 'messageOriginHiddenUser'; sender_name: string }
  | { '@type': 'messageOriginChat'; sender_chat_id: number; author_signature: string }
  | { '@type': 'messageOriginChannel'; chat_id: number; message_id: number; author_signature: string };

export interface TdMessageReplyTo {
  '@type': string;
  chat_id?: number;
  message_id?: number;
  quote?: { text: TdFormattedText } | null;
  origin?: TdMessageOrigin | null;
  content?: TdMessageContent | null;
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
  is_channel_post?: boolean;
  interaction_info?: TdInteractionInfo | null;
  sending_state?: { '@type': 'messageSendingStatePending' | 'messageSendingStateFailed' } | null;
  forward_info?: { origin: TdMessageOrigin; date: number } | null;
  reply_to?: TdMessageReplyTo | null;
  author_signature?: string;
  reply_markup?: { '@type': string; rows?: { text: string; type: { '@type': string; [k: string]: unknown } }[][] } | null;
  media_album_id?: string;
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
  accent_color_id?: number;
  draft_message?: { content?: { '@type': string; text?: TdFormattedText } } | null;
  permissions?: Record<string, boolean>;
  last_read_inbox_message_id?: number;
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
  accent_color_id?: number;
  is_contact?: boolean;
  is_premium?: boolean;
}

export interface TdChatMemberStatus {
  '@type': string;
  rights?: Record<string, boolean>;
  is_member?: boolean;
}

export interface TdSupergroup {
  '@type': 'supergroup';
  id: number;
  usernames?: { active_usernames: string[] } | null;
  status: TdChatMemberStatus;
  member_count: number;
  sign_messages?: boolean;
  is_channel: boolean;
  join_to_send_messages?: boolean;
  is_forum?: boolean;
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
