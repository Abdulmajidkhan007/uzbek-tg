/**
 * Xabar ichidagi havola/mention/hashtag bosilganda nima bo'lishi.
 * ChatDetail o'z navigatsiyasi bilan Provider beradi; standart — brauzer.
 */
import { createContext, useContext } from 'react';
import { Linking } from 'react-native';

export interface ChatLinkHandlers {
  /** http(s), t.me, tel:, mailto: va boshqa havolalar. */
  openUrl: (url: string) => void;
  /** @username */
  openMention: (username: string) => void;
  /** textEntityTypeMentionName — foydalanuvchi profili. */
  openUser: (userId: string) => void;
  /** #hashtag / $cashtag — chat ichida qidirish. */
  onHashtag?: (tag: string) => void;
  /** /command — botga yuborish. */
  onBotCommand?: (command: string) => void;
}

export function normalizeUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `https://${url}`;
}

export const defaultLinkHandlers: ChatLinkHandlers = {
  openUrl: (url) => {
    Linking.openURL(normalizeUrl(url)).catch(() => undefined);
  },
  openMention: (username) => {
    Linking.openURL(`https://t.me/${username.replace(/^@/, '')}`).catch(() => undefined);
  },
  openUser: () => undefined,
};

export const ChatLinkContext = createContext<ChatLinkHandlers>(defaultLinkHandlers);

export function useChatLinks(): ChatLinkHandlers {
  return useContext(ChatLinkContext);
}
