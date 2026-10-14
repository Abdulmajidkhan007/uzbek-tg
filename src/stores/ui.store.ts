/**
 * Ilova (qurilma) darajasidagi sozlamalar: mavzu, til, chat ko'rinishi,
 * ilova ichidagi bildirishnomalar, avto-yuklash va kesh. AsyncStorage'da saqlanadi.
 * Akkauntga oid sozlamalar (maxfiylik, bildirishnoma doiralari) — TDLib'da.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import type { ThemeMode } from '@/theme';

export type Lang = 'uz' | 'en' | 'ru';
export type AccentKey = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal' | 'pink';

export type Wallpaper =
  | { type: 'none' }
  | { type: 'color'; value: string }
  | { type: 'gradient'; value: string[] }
  | { type: 'image'; value: string };

export interface AutoDownloadRule {
  enabled: boolean;
  photos: boolean;
  videos: boolean;
  /** Video uchun maksimal hajm (MB). */
  videoMaxMb: number;
  files: boolean;
  fileMaxMb: number;
}

export interface Prefs {
  themeMode: ThemeMode;
  language: Lang;
  accent: AccentKey;
  /** Xabar matni o'lchami (12..24). */
  messageFontSize: number;
  /** Xabar burchaklari radiusi (0..20). */
  bubbleRadius: number;
  wallpaper: Wallpaper;
  /** Chatlar ro'yxatida oldindan ko'rinish qatorlari. */
  chatListLines: 2 | 3;
  sendWithEnter: boolean;
  /** Ilova ichida: tovush, tebranish, oldindan ko'rinish. */
  inAppSounds: boolean;
  inAppVibrate: boolean;
  inAppPreview: boolean;
  /** Telefon bildirishnomalari (ilova jarayoni ishlayotganda). */
  notificationsEnabled: boolean;
  autoDownload: { mobile: AutoDownloadRule; wifi: AutoDownloadRule; roaming: AutoDownloadRule };
  /** Keshni avtomatik tozalash (kun; 0 = hech qachon). */
  keepMedia: { private: number; groups: number; channels: number };
  /** Kesh chegarasi (GB; 0 = cheksiz). */
  maxCacheGb: number;
}

export const DEFAULT_PREFS: Prefs = {
  themeMode: 'dark',
  language: detectLanguage(),
  accent: 'blue',
  messageFontSize: 16,
  bubbleRadius: 17,
  wallpaper: { type: 'gradient', value: ['#0E1621', '#17212B'] },
  chatListLines: 2,
  sendWithEnter: false,
  inAppSounds: true,
  inAppVibrate: true,
  inAppPreview: true,
  notificationsEnabled: true,
  autoDownload: {
    mobile: { enabled: true, photos: true, videos: true, videoMaxMb: 10, files: true, fileMaxMb: 1 },
    wifi: { enabled: true, photos: true, videos: true, videoMaxMb: 15, files: true, fileMaxMb: 3 },
    roaming: { enabled: true, photos: true, videos: false, videoMaxMb: 1, files: false, fileMaxMb: 1 },
  },
  keepMedia: { private: 0, groups: 30, channels: 7 },
  maxCacheGb: 5,
};

function detectLanguage(): Lang {
  try {
    const locale: string =
      Platform.OS === 'android'
        ? NativeModules.I18nManager?.localeIdentifier ?? ''
        : NativeModules.SettingsManager?.settings?.AppleLocale ?? '';
    const l = locale.slice(0, 2).toLowerCase();
    if (l === 'ru') return 'ru';
    if (l === 'en') return 'en';
  } catch {
    // ignore
  }
  return 'uz';
}

interface UIState extends Prefs {
  isKeyboardVisible: boolean;
  activeBottomSheet: string | null;
  /** Bir nechta sozlamani birdaniga o'zgartiradi va saqlaydi. */
  setPrefs: (patch: Partial<Prefs>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Lang) => void;
  setKeyboardVisible: (visible: boolean) => void;
  openBottomSheet: (id: string) => void;
  closeBottomSheet: () => void;
}

const PREFS_KEY = '@uzbektg/prefs';
const OLD_THEME_KEY = '@pulse/theme_mode';

function pickPrefs(s: UIState): Prefs {
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_PREFS)) out[k] = (s as unknown as Record<string, unknown>)[k];
  return out as unknown as Prefs;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(pickPrefs(useUIStore.getState()))).catch(() => undefined);
  }, 200);
}

export const useUIStore = create<UIState>((set) => ({
  ...DEFAULT_PREFS,
  isKeyboardVisible: false,
  activeBottomSheet: null,

  setPrefs: (patch) => {
    set(patch);
    persist();
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    persist();
  },
  setLanguage: (language) => {
    set({ language });
    persist();
  },
  setKeyboardVisible: (visible) => set({ isKeyboardVisible: visible }),
  openBottomSheet: (id) => set({ activeBottomSheet: id }),
  closeBottomSheet: () => set({ activeBottomSheet: null }),
}));

export async function initUIStore(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Prefs>;
      useUIStore.setState({
        ...saved,
        autoDownload: { ...DEFAULT_PREFS.autoDownload, ...saved.autoDownload },
        keepMedia: { ...DEFAULT_PREFS.keepMedia, ...saved.keepMedia },
      });
      return;
    }
    const old = await AsyncStorage.getItem(OLD_THEME_KEY);
    if (old === 'dark' || old === 'light' || old === 'system') useUIStore.setState({ themeMode: old });
  } catch {
    // Buzilgan saqlangan qiymat — standart sozlamalar qoladi.
  }
}
