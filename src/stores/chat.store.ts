import { create } from 'zustand';

export type ChatType = 'private' | 'group' | 'channel' | 'topic_group';
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface UserPreview {
  id: string;
  username?: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'recently' | 'last_seen';
  isVerified: boolean;
  /** userStatusOffline.was_online (unix soniya). */
  wasOnline?: number;
  /** status 'offline' bo'lganda aniqroq: o'tgan hafta / oy / uzoq vaqt. */
  statusDetail?: 'lastWeek' | 'lastMonth' | 'longAgo';
  isBot?: boolean;
  /** Ism rangi (Telegram accent_color_id, 0..6 asosiy ranglar). */
  colorId?: number;
}

export interface MessageReply {
  messageId: string;
  /** Javob berilgan xabar chati (boshqa chatdan bo'lishi mumkin). */
  chatId?: string;
  senderId: string;
  senderName: string;
  contentPreview: string;
  type: MessageType;
  /** Iqtibos (textQuote) — bo'lsa preview o'rniga ko'rsatiladi. */
  quote?: string;
  colorId?: number;
  /** Javob berilgan xabar hali yuklanmagan. */
  isLoading?: boolean;
}

/** formattedText.entities → UI uchun soddalashtirilgan. */
export interface TextEntity {
  offset: number;
  length: number;
  /** textEntityType* nomidan 'textEntityType' qismi olib tashlangan: 'Bold', 'TextUrl', ... */
  type: string;
  url?: string;
  userId?: string;
  language?: string;
}

export type InlineButtonKind =
  | 'url'
  | 'loginUrl'
  | 'webApp'
  | 'callback'
  | 'callbackWithPassword'
  | 'callbackGame'
  | 'switchInline'
  | 'buy'
  | 'user'
  | 'copyText'
  | 'disabled'
  | 'unknown';

export interface InlineButton {
  text: string;
  kind: InlineButtonKind;
  url?: string;
  /** Callback ma'lumoti (base64 bytes — TDLib'ga o'zgarishsiz qaytariladi). */
  data?: string;
  userId?: string;
  copyText?: string;
  query?: string;
}

export interface PollInfo {
  id: string;
  question: string;
  questionEntities?: TextEntity[];
  options: { id: string; text: string; voterCount: number; percent: number; isChosen: boolean; isBeingChosen: boolean }[];
  totalVoters: number;
  isClosed: boolean;
  isAnonymous: boolean;
  isQuiz: boolean;
  allowsMultiple: boolean;
  /** Ovoz berilgan (yoki natijalarni ko'rish mumkin). */
  hasVoted: boolean;
}

export interface LinkPreviewInfo {
  url: string;
  siteName?: string;
  title?: string;
  description?: string;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: readonly string[];
  hasCurrentUser: boolean;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderPreview: UserPreview;
  type: MessageType;
  text?: string;
  status: MessageStatus;
  sentAt: Date;
  editedAt?: Date;
  isDeleted: boolean;
  isPinned: boolean;
  replyTo: MessageReply | null;
  reactions: readonly Reaction[];
  mediaUrl?: string;
  duration?: number;
  waveform?: number[];
  fileName?: string;
  fileSize?: number;
  /** Ro'yxat/qidiruv uchun bir qatorli matn (masalan "📷 Rasm izoh"). */
  previewText?: string;
  /** Media turi: bubble qanday chizilishini aniqlaydi. */
  mediaKind?: 'photo' | 'video' | 'gif' | 'sticker' | 'videoNote';
  /** Kichik oldindan ko'rinish (minithumbnail data: URI yoki thumbnail fayl). */
  thumbUrl?: string;
  mediaWidth?: number;
  mediaHeight?: number;
  /** TDLib fayl id — to'liq faylni yuklab olish/ijro uchun. */
  mediaFileId?: number;
  /** To'liq fayl lokal yo'li (yuklab bo'lingan bo'lsa, file:// siz). */
  mediaLocalPath?: string;
  mimeType?: string;
  /** Yuklab olish / yuborish jarayoni (0..1). */
  downloadProgress?: number;
  uploadProgress?: number;
  /** Rasm avto-yuklanmadi — xira thumb + yuklab olish tugmasi. */
  needsDownload?: boolean;

  /** Matn (yoki izoh) formatlash belgilari. */
  entities?: TextEntity[];
  /** Xizmat xabari (a'zo qo'shildi, xabar qadaldi, ...) — markazda pill. */
  isService?: boolean;
  isChannelPost?: boolean;
  /** Kanal posti ko'rishlar soni. */
  viewCount?: number;
  /** Izohlar (kanal muhokama guruhi) — reply_info bo'lsa. */
  hasComments?: boolean;
  replyCount?: number;
  isEdited?: boolean;
  authorSignature?: string;
  /** "Forwarded from X" — X nomi. */
  forwardFrom?: string;
  /** Inline tugmalar qatorlari. */
  replyMarkup?: InlineButton[][];
  poll?: PollInfo;
  contact?: { name: string; phone: string; userId?: string };
  location?: { latitude: number; longitude: number; title?: string; address?: string };
  /** Dice / animatsiyali emoji — katta qilib ko'rsatiladi. */
  bigEmoji?: string;
  linkPreview?: LinkPreviewInfo;
  /** Ism rangi (guruhlarda). */
  senderColorId?: number;
  senderName?: string;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string;
  avatarUrl?: string;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  /** Qo'lda "o'qilmagan" deb belgilangan. */
  isMarkedUnread?: boolean;
  otherUser?: UserPreview;
  memberCount?: number;
  isOnline?: boolean;
  isTyping?: boolean;
  typingUserName?: string;
  updatedAt: Date;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  userName: string;
  startedAt: Date;
}

export interface ChatFolder {
  id: number;
  name: string;
  unreadCount: number;
}

interface ChatState {
  chats: Chat[];
  /** Telegram chat papkalari (Sozlamalar → Chat papkalari) va arxiv. */
  folders: ChatFolder[];
  /** Ro'yxat kaliti bo'yicha chatlar: 'archive', 'folder:<id>'. Asosiy ro'yxat — `chats`. */
  listChats: Record<string, Chat[]>;
  messages: Record<string, ChatMessage[]>;
  typingIndicators: TypingIndicator[];
  activeChatId: string | null;
  isLoadingChats: boolean;
  isLoadingMessages: Record<string, boolean>;
  pinnedMessages: Record<string, ChatMessage[]>;
  replyingTo: ChatMessage | null;
  forwardingMessage: ChatMessage | null;

  setChats: (chats: Chat[]) => void;
  setMessages: (chatId: string, messages: ChatMessage[]) => void;
  addMessage: (chatId: string, message: ChatMessage) => void;
  updateMessage: (chatId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  setActiveChatId: (chatId: string | null) => void;
  setTypingIndicator: (indicator: TypingIndicator | null) => void;
  markChatAsRead: (chatId: string) => void;
  setPinnedMessages: (chatId: string, messages: ChatMessage[]) => void;
  setReplyingTo: (message: ChatMessage | null) => void;
  setForwardingMessage: (message: ChatMessage | null) => void;
  toggleChatPin: (chatId: string) => void;
  toggleChatMute: (chatId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  folders: [],
  listChats: {},
  messages: {},
  typingIndicators: [],
  activeChatId: null,
  isLoadingChats: false,
  isLoadingMessages: {},
  pinnedMessages: {},
  replyingTo: null,
  forwardingMessage: null,

  setChats: (chats) => set({ chats }),

  setMessages: (chatId, messages) =>
    set((s) => ({ messages: { ...s.messages, [chatId]: messages } })),

  addMessage: (chatId, message) =>
    set((s) => {
      const existing = s.messages[chatId] ?? [];
      const chats = s.chats.map((c) =>
        c.id === chatId ? { ...c, lastMessage: message, updatedAt: message.sentAt } : c
      );
      return {
        messages: { ...s.messages, [chatId]: [...existing, message] },
        chats,
      };
    }),

  updateMessage: (chatId, messageId, patch) =>
    set((s) => {
      const existing = s.messages[chatId] ?? [];
      return {
        messages: {
          ...s.messages,
          [chatId]: existing.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
        },
      };
    }),

  deleteMessage: (chatId, messageId) =>
    set((s) => {
      const existing = s.messages[chatId] ?? [];
      return {
        messages: {
          ...s.messages,
          [chatId]: existing.map((m) =>
            m.id === messageId ? { ...m, isDeleted: true, text: undefined } : m
          ),
        },
      };
    }),

  setActiveChatId: (chatId) => set({ activeChatId: chatId }),

  setTypingIndicator: (indicator) =>
    set((s) => {
      if (!indicator) return { typingIndicators: [] };
      const filtered = s.typingIndicators.filter(
        (t) => !(t.chatId === indicator.chatId && t.userId === indicator.userId)
      );
      return { typingIndicators: [...filtered, indicator] };
    }),

  markChatAsRead: (chatId) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    })),

  setPinnedMessages: (chatId, messages) =>
    set((s) => ({ pinnedMessages: { ...s.pinnedMessages, [chatId]: messages } })),

  setReplyingTo: (message) => set({ replyingTo: message }),
  setForwardingMessage: (message) => set({ forwardingMessage: message }),

  toggleChatPin: (chatId) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, isPinned: !c.isPinned } : c)),
    })),

  toggleChatMute: (chatId) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, isMuted: !c.isMuted } : c)),
    })),
}));
