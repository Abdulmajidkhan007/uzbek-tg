/**
 * Ghost mode: o'qilgan belgisi, "online" va "yozmoqda" holatlari hamda
 * hikoya ko'rilganligi Telegram'ga yuborilmaydi. Hamma tegishli chaqiruvlar
 * shu yerdagi `isGhost(...)` orqali tekshiriladi.
 *
 * Holat useUIStore (AsyncStorage) da saqlanadi — ilova qayta ochilganda tiklanadi.
 * `online` TDLib option'i: ilova oldingi planda va ghost o'chiq bo'lsagina true.
 */
import { AppState } from 'react-native';
import { td } from './client';
import { useUIStore } from '@/stores/ui.store';

export type GhostKind = 'read' | 'online' | 'typing' | 'stories';

const KEYS = {
  read: 'ghostRead',
  online: 'ghostOnline',
  typing: 'ghostTyping',
  stories: 'ghostStories',
} as const;

/** Shu turdagi ma'lumot yuborilmasligi kerakmi (umumiy kalit yoqilgan va tur tanlangan). */
export function isGhost(kind: GhostKind): boolean {
  const s = useUIStore.getState();
  return s.ghostEnabled && s[KEYS[kind]];
}

let lastOnline: boolean | null = null;

/** TDLib `online` option'ini ilova holati va ghost sozlamasiga moslaydi. */
export function syncOnline(force = false): void {
  const online = AppState.currentState === 'active' && !isGhost('online');
  if (!force && online === lastOnline) return;
  lastOnline = online;
  td({ '@type': 'setOption', name: 'online', value: { '@type': 'optionValueBoolean', value: online } }).catch(() => {
    lastOnline = null;
  });
}

let started = false;
/** Avtorizatsiyadan keyin chaqiriladi: AppState va sozlama o'zgarishini kuzatadi. */
export function startGhost(): void {
  if (started) return;
  started = true;
  syncOnline(true);
  AppState.addEventListener('change', () => syncOnline());
  useUIStore.subscribe(() => syncOnline());
}
