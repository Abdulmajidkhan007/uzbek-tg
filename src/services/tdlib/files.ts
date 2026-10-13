/**
 * TDLib fayllari (avatar va h.k.): yuklab olishni so'rash va tayyor bo'lganda
 * lokal yo'lni berish. Yuklab bo'lingach `onFilesChanged` obunachilari chaqiriladi.
 */
import { onTdUpdate, td } from './client';
import type { TdFile, TdObject } from './types';

const paths = new Map<number, string>();
const requested = new Set<number>();
const listeners = new Set<() => void>();
let started = false;

function ensureListener(): void {
  if (started) return;
  started = true;
  onTdUpdate((update: TdObject) => {
    if (update['@type'] !== 'updateFile') return;
    const file = update.file as TdFile;
    if (file.local.is_downloading_completed && file.local.path) {
      paths.set(file.id, file.local.path);
      listeners.forEach((fn) => fn());
    }
  });
}

export function fileUri(file: TdFile | undefined): string | undefined {
  if (!file) return undefined;
  const path =
    paths.get(file.id) ??
    (file.local.is_downloading_completed && file.local.path ? file.local.path : undefined);
  return path ? `file://${path}` : undefined;
}

/** Fayl hali lokal bo'lmasa yuklab olishni boshlaydi (har fayl uchun bir marta). */
export function requestFile(file: TdFile | undefined): void {
  if (!file || file.local.is_downloading_completed || requested.has(file.id)) return;
  ensureListener();
  requested.add(file.id);
  td({ '@type': 'downloadFile', file_id: file.id, priority: 1, synchronous: false }).catch(() => {
    requested.delete(file.id);
  });
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
  return `file://${file.local.path}`;
}
