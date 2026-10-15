/**
 * Hikoyalar (stories) holati: faol hikoyasi bor chatlar ro'yxati (TDLib
 * storyListMain, `order` bo'yicha kamayish tartibida) va o'zimizning hikoyalar.
 * Ma'lumot manbai — src/services/tdlib/stories.ts.
 */
import { create } from 'zustand';

export interface StoryChat {
  chatId: string;
  /** Chat nomi (shaxsiy chatda — foydalanuvchi ismi). */
  name: string;
  avatarUri?: string;
  /** TDLib chatActiveStories.order (0 — ro'yxatda ko'rsatilmaydi). */
  order: number;
  maxReadId: number;
  /** Faol hikoya id'lari, o'sish tartibida (TDLib bergan tartib). */
  storyIds: number[];
  /** Kamida bitta hikoya id > max_read_story_id. */
  hasUnread: boolean;
}

interface StoriesState {
  /** Asosiy ro'yxat (o'zimizdan tashqari). */
  main: StoryChat[];
  /** O'zimizning faol hikoyalar (Saved Messages chati); yo'q bo'lsa null. */
  own: StoryChat | null;
  /** O'zimizning Saved Messages chat id'si (hikoya joylash uchun). */
  myChatId: string | null;
  /** Hozir joylanayotgan hikoyalar soni. */
  posting: number;
}

export const useStoriesStore = create<StoriesState>(() => ({
  main: [],
  own: null,
  myChatId: null,
  posting: 0,
}));
