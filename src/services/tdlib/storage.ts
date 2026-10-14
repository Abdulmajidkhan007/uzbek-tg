/**
 * Xotira va tarmoq: TDLib kesh statistikasi (getStorageStatistics),
 * keshni avtomatik tozalash siyosati (optimizeStorage) va tarmoq turini
 * TDLib'ga bildirish (setNetworkType).
 *
 * optimizeStorage semantikasi (td/telegram/files/FileGcParameters.cpp):
 *   size  — o'chirishdan keyin qoladigan umumiy hajm chegarasi (bayt), -1 = standart (100 MB)
 *   ttl   — oxirgi ochilgandan beri o'tgan vaqt chegarasi (s), -1 = standart (23 soat)
 *   count — qoladigan fayllar soni chegarasi, -1 = standart (40000)
 * Shuning uchun "faqat ttl bo'yicha" tozalash uchun size/count juda katta beriladi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { td } from './client';
import type { TdObject } from './types';
import { useUIStore } from '@/stores/ui.store';
import { useChatStore } from '@/stores/chat.store';
import { refreshNetworkType, startNetworkWatch, type NetworkKind } from '@/services/autoDownload';

// ---------------------------------------------------------------------------
// Fayl turlari → toifalar (Telegram'dagi "Xotiradan foydalanish" ro'yxati)
// ---------------------------------------------------------------------------
export type FileCategory =
  | 'photos'
  | 'videos'
  | 'voice'
  | 'videoNotes'
  | 'music'
  | 'files'
  | 'stickers'
  | 'gifs'
  | 'profilePhotos'
  | 'other';

export const FILE_CATEGORIES: { key: FileCategory; color: string; icon: string; types: string[] }[] = [
  {
    key: 'photos',
    color: '#3E9BEA',
    icon: 'image',
    types: ['fileTypePhoto', 'fileTypeSelfDestructingPhoto', 'fileTypePhotoStory', 'fileTypeLivePhotoVideo', 'fileTypeSelfDestructingLivePhotoVideo'],
  },
  { key: 'videos', color: '#8D6BDC', icon: 'videocam', types: ['fileTypeVideo', 'fileTypeSelfDestructingVideo', 'fileTypeVideoStory'] },
  { key: 'voice', color: '#F2A23A', icon: 'mic', types: ['fileTypeVoiceNote', 'fileTypeSelfDestructingVoiceNote'] },
  { key: 'videoNotes', color: '#2CB9B0', icon: 'aperture', types: ['fileTypeVideoNote', 'fileTypeSelfDestructingVideoNote'] },
  { key: 'music', color: '#E9546B', icon: 'musical-notes', types: ['fileTypeAudio'] },
  { key: 'files', color: '#4FBC6B', icon: 'document', types: ['fileTypeDocument'] },
  { key: 'stickers', color: '#F06EAA', icon: 'happy', types: ['fileTypeSticker'] },
  { key: 'gifs', color: '#E8C13A', icon: 'film', types: ['fileTypeAnimation'] },
  { key: 'profilePhotos', color: '#6C8EF0', icon: 'person-circle', types: ['fileTypeProfilePhoto'] },
  // Qolgan barcha turlar (thumbnail, wallpaper, unknown, secure, ...) — "Boshqa".
  { key: 'other', color: '#9AA4AF', icon: 'folder', types: ['fileTypeUnknown'] },
];

const TYPE_TO_CATEGORY = new Map<string, FileCategory>();
for (const c of FILE_CATEGORIES) for (const ty of c.types) TYPE_TO_CATEGORY.set(ty, c.key);

export function categoryOfFileType(type: string): FileCategory {
  return TYPE_TO_CATEGORY.get(type) ?? 'other';
}

/** Bayt → "2.5 GB" / "120.3 MB" / "12 KB". */
export function formatBytes(bytes: number): string {
  const b = Math.max(0, bytes || 0);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10 * 1024 ? 1 : 0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ---------------------------------------------------------------------------
// TDLib obyektlari
// ---------------------------------------------------------------------------
export interface TdStorageFast extends TdObject {
  files_size: number;
  file_count: number;
  database_size: number;
  language_pack_database_size: number;
  log_size: number;
}

export interface TdStorageByFileType {
  file_type: { '@type': string };
  size: number;
  count: number;
}

export interface TdStorageByChat {
  chat_id: number;
  size: number;
  count: number;
  by_file_type: TdStorageByFileType[];
}

export interface TdStorageStatistics extends TdObject {
  size: number;
  count: number;
  by_chat: TdStorageByChat[];
}

export function getStorageFast(): Promise<TdStorageFast> {
  return td<TdStorageFast>({ '@type': 'getStorageStatisticsFast' });
}

export function getStorageStats(chatLimit = 100): Promise<TdStorageStatistics> {
  return td<TdStorageStatistics>({ '@type': 'getStorageStatistics', chat_limit: chatLimit });
}

const INT32_MAX = 2147483647;
/** int53 doirasidagi "cheksiz" hajm (≈ 1 PB). */
const HUGE_SIZE = 1024 ** 5;

interface OptimizeParams {
  size?: number;
  ttl?: number;
  count?: number;
  immunity_delay?: number;
  file_types?: string[];
  chat_ids?: number[];
  exclude_chat_ids?: number[];
}

/** optimizeStorage; o'chirilgan fayllar statistikasini qaytaradi. */
export function optimizeStorage(p: OptimizeParams): Promise<TdStorageStatistics> {
  return td<TdStorageStatistics>({
    '@type': 'optimizeStorage',
    size: p.size ?? 0,
    ttl: p.ttl ?? 0,
    count: p.count ?? 0,
    immunity_delay: p.immunity_delay ?? 0,
    file_types: (p.file_types ?? []).map((ty) => ({ '@type': ty })),
    chat_ids: p.chat_ids ?? [],
    exclude_chat_ids: p.exclude_chat_ids ?? [],
    return_deleted_file_statistics: true,
    chat_limit: 0,
  });
}

// ---------------------------------------------------------------------------
// Avtomatik tozalash siyosati (Keep media + Maksimal kesh hajmi)
// ---------------------------------------------------------------------------
const POLICY_KEY = '@uzbektg/storage_policy_at';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Sozlamalarga ko'ra keshni tozalaydi. Sutkada bir marta (force bo'lmasa).
 * Chat turlari bo'yicha ro'yxat — chat.store'dagi yuklangan (asosiy) chatlar.
 */
export async function applyStoragePolicy(force = false): Promise<void> {
  try {
    if (!force) {
      const last = Number(await AsyncStorage.getItem(POLICY_KEY));
      if (last && Date.now() - last < DAY_MS) return;
    }
    const { keepMedia, maxCacheGb } = useUIStore.getState();
    const chats = useChatStore.getState().chats;
    const byKind: Record<'private' | 'groups' | 'channels', number[]> = { private: [], groups: [], channels: [] };
    for (const c of chats) {
      const id = Number(c.id);
      if (!Number.isFinite(id)) continue;
      if (c.type === 'private') byKind.private.push(id);
      else if (c.type === 'channel') byKind.channels.push(id);
      else byKind.groups.push(id);
    }
    for (const kind of ['private', 'groups', 'channels'] as const) {
      const days = keepMedia[kind];
      const ids = byKind[kind];
      if (!days || ids.length === 0) continue;
      await optimizeStorage({
        size: HUGE_SIZE,
        ttl: days * 86400,
        count: INT32_MAX,
        immunity_delay: -1,
        chat_ids: ids,
      }).catch(() => undefined);
    }
    if (maxCacheGb > 0) {
      await optimizeStorage({
        size: maxCacheGb * 1024 ** 3,
        ttl: INT32_MAX,
        count: INT32_MAX,
        immunity_delay: -1,
      }).catch(() => undefined);
    }
    await AsyncStorage.setItem(POLICY_KEY, String(Date.now()));
  } catch {
    // Siyosat bajarilmasa — keyingi ishga tushishda qayta urinadi.
  }
}

let policyTimer: ReturnType<typeof setTimeout> | null = null;
/** Login'dan keyin chaqiriladi: 60 s o'tib siyosatni qo'llaydi. */
export function startStoragePolicy(): void {
  if (policyTimer) return;
  policyTimer = setTimeout(() => {
    policyTimer = null;
    void applyStoragePolicy();
  }, 60000);
}

// ---------------------------------------------------------------------------
// Tarmoq turi → TDLib (statistika Mobil/Wi-Fi/Rouming bo'yicha ajratiladi)
// ---------------------------------------------------------------------------
export function setTdNetworkType(kind: NetworkKind): Promise<void> {
  const type =
    kind === 'wifi' ? 'networkTypeWiFi' : kind === 'roaming' ? 'networkTypeMobileRoaming' : 'networkTypeMobile';
  return td({ '@type': 'setNetworkType', type: { '@type': type } }).then(
    () => undefined,
    () => undefined,
  );
}

let networkSyncStarted = false;
/** Tarmoq turini kuzatadi va o'zgarganda TDLib'ga bildiradi. */
export function startNetworkSync(): void {
  if (networkSyncStarted) return;
  networkSyncStarted = true;
  void refreshNetworkType().then(setTdNetworkType);
  startNetworkWatch((n) => {
    void setTdNetworkType(n);
  });
}
