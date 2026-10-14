/**
 * TDLib fayllari (avatar, media, hujjatlar): yuklab olishni so'rash, tayyor
 * bo'lganda lokal yo'lni berish va yuklash/yuborish jarayonini kuzatish.
 * Fayl holati o'zgarganda `onFilesChanged` obunachilari chaqiriladi.
 */
import { onTdUpdate, td } from './client';
import type { TdFile, TdObject } from './types';

const paths = new Map<number, string>();
const requested = new Set<number>();
const listeners = new Set<() => void>();
/** Fayl jarayoni: yuklab olingan / yuborilgan bayt va umumiy hajm. */
const progress = new Map<number, { downloaded: number; uploaded: number; size: number; downloading: boolean; uploading: boolean }>();
let started = false;

function ensureListener(): void {
  if (started) return;
  started = true;
  onTdUpdate((update: TdObject) => {
    if (update['@type'] !== 'updateFile') return;
    const file = update.file as TdFile;
    const size = file.size || file.expected_size || 0;
    const downloading = file.local.is_downloading_active ?? false;
    const uploading = file.remote?.is_uploading_active ?? false;
    const prev = progress.get(file.id);
    if (downloading || uploading || prev) {
      progress.set(file.id, {
        downloaded: file.local.downloaded_size ?? 0,
        uploaded: file.remote?.uploaded_size ?? 0,
        size,
        downloading,
        uploading,
      });
    }
    if (file.local.is_downloading_completed && file.local.path) {
      paths.set(file.id, file.local.path);
    }
    if (downloading || uploading || prev || file.local.is_downloading_completed) {
      listeners.forEach((fn) => fn());
    }
  });
}

export function fileUri(file: TdFile | undefined): string | undefined {
  const path = filePath(file);
  return path ? `file://${path}` : undefined;
}

/** To'liq yuklab olingan faylning lokal yo'li (file:// siz). */
export function filePath(file: TdFile | undefined): string | undefined {
  if (!file) return undefined;
  return paths.get(file.id) ?? (file.local.is_downloading_completed && file.local.path ? file.local.path : undefined);
}

/** Fayl hali lokal bo'lmasa yuklab olishni boshlaydi (har fayl uchun bir marta). */
export function requestFile(file: TdFile | undefined, priority = 1): void {
  if (!file || file.local.is_downloading_completed || requested.has(file.id)) return;
  ensureListener();
  requested.add(file.id);
  td({ '@type': 'downloadFile', file_id: file.id, priority, offset: 0, limit: 0, synchronous: false }).catch(() => {
    requested.delete(file.id);
  });
}

/** Fayl id bo'yicha yuklab olishni boshlaydi (fon rejimida, jarayon updateFile orqali). */
export function requestFileById(fileId: number, priority = 16): void {
  if (paths.has(fileId)) return;
  ensureListener();
  requested.add(fileId);
  listeners.forEach((fn) => fn());
  td({ '@type': 'downloadFile', file_id: fileId, priority, offset: 0, limit: 0, synchronous: false }).catch(() => {
    requested.delete(fileId);
    listeners.forEach((fn) => fn());
  });
}

/** Faylni yuklab olish so'ralganmi (avto yoki foydalanuvchi bosgani). */
export function isFileRequested(fileId: number): boolean {
  return requested.has(fileId);
}

/** Yuklab olish jarayoni 0..1 (faol bo'lmasa undefined). */
export function downloadProgressOf(fileId: number | undefined): number | undefined {
  if (fileId == null) return undefined;
  const p = progress.get(fileId);
  if (!p || !p.downloading || !p.size) return undefined;
  return Math.min(1, p.downloaded / p.size);
}

/** Yuborish (upload) jarayoni 0..1 (faol bo'lmasa undefined). */
export function uploadProgressOf(fileId: number | undefined): number | undefined {
  if (fileId == null) return undefined;
  const p = progress.get(fileId);
  if (!p || !p.uploading || !p.size) return undefined;
  return Math.min(1, p.uploaded / p.size);
}

/** Yuklab olishni to'xtatadi. */
export function cancelDownload(fileId: number): void {
  requested.delete(fileId);
  td({ '@type': 'cancelDownloadFile', file_id: fileId, only_if_pending: false }).catch(() => undefined);
}

export function onFilesChanged(fn: () => void): () => void {
  ensureListener();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Faylni to'liq yuklab olguncha kutadi va lokal URI qaytaradi. */
export async function downloadFileNow(fileId: number): Promise<string> {
  ensureListener();
  const file = await td<TdFile & TdObject>({
    '@type': 'downloadFile',
    file_id: fileId,
    priority: 32,
    offset: 0,
    limit: 0,
    synchronous: true,
  });
  if (!file.local.is_downloading_completed || !file.local.path) {
    throw new Error('Fayl yuklab olinmadi');
  }
  paths.set(file.id, file.local.path);
  listeners.forEach((fn) => fn());
  return `file://${file.local.path}`;
}
