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
}

export interface MessageReply {
  messageId: string;
  senderId: string;
  senderName: string;
  contentPreview: string;
  type: MessageType;
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

interface ChatState {
  chats: Chat[];
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
