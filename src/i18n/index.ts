/**
 * Ko'p tillilik: o'zbekcha (asosiy), English, Русский.
 *
 *   const t = useT();            // komponent ichida (til o'zgarsa qayta chiziladi)
 *   t('common.cancel')
 *   t('chat.members', { n: 5 })  // {n} o'rniga qiymat
 *   tp('chat.membersCount', 5)   // ko'plik shakli (ru: _one/_few/_many, en: _one/_other)
 *
 * Har bir bo'lim o'z faylida: locales/<nom>.ts → { uz: {...}, en: {...}, ru: {...} }.
 * Kalitlar bo'lim nomi bilan boshlanadi ("settings.privacy.title").
 */
import { useUIStore } from '@/stores/ui.store';
import common from './locales/common';
import main from './locales/main';
import chat from './locales/chat';
import settings from './locales/settings';
import data from './locales/data';
import appearance from './locales/appearance';

import type { Lang } from '@/stores/ui.store';
export type { Lang };
export type Dict = Record<string, string>;
export type Locale = Record<Lang, Dict>;

export const LANGUAGES: { code: Lang; name: string; native: string }[] = [
  { code: 'uz', name: "O'zbekcha", native: "O'zbekcha" },
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
];

const parts: Locale[] = [common, main, chat, settings, data, appearance];
const dicts: Record<Lang, Dict> = { uz: {}, en: {}, ru: {} };
for (const p of parts) {
  for (const l of ['uz', 'en', 'ru'] as Lang[]) Object.assign(dicts[l], p[l]);
}

function format(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] !== undefined ? String(params[k]) : m));
}

export function currentLang(): Lang {
  return useUIStore.getState().language;
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const s = dicts[lang][key] ?? dicts.uz[key] ?? dicts.en[key] ?? key;
  return format(s, params);
}

/** Komponentdan tashqarida (servislar) ishlatish uchun. */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(currentLang(), key, params);
}

function pluralSuffix(lang: Lang, n: number): string {
  const a = Math.abs(n);
  if (lang === 'ru') {
    const m10 = a % 10;
    const m100 = a % 100;
    if (m10 === 1 && m100 !== 11) return '_one';
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return '_few';
    return '_many';
  }
  if (lang === 'en') return a === 1 ? '_one' : '_other';
  return '';
}

export function translatePlural(lang: Lang, key: string, n: number, params?: Record<string, string | number>): string {
  const k = key + pluralSuffix(lang, n);
  const s = dicts[lang][k] ?? dicts[lang][key] ?? dicts.uz[key] ?? key;
  return format(s, { n, ...params });
}

export function tp(key: string, n: number, params?: Record<string, string | number>): string {
  return translatePlural(currentLang(), key, n, params);
}

export interface Translator {
  (key: string, params?: Record<string, string | number>): string;
  /** Ko'plik shakli bilan. */
  p: (key: string, n: number, params?: Record<string, string | number>) => string;
  lang: Lang;
}

/** Hook: til o'zgarganda komponent qayta chiziladi. */
export function useT(): Translator {
  const lang = useUIStore((s) => s.language);
  const fn = ((key: string, params?: Record<string, string | number>) => translate(lang, key, params)) as Translator;
  fn.p = (key, n, params) => translatePlural(lang, key, n, params);
  fn.lang = lang;
  return fn;
}

/** date-fns uchun oy va hafta kunlari (qisqa). */
export function shortWeekdays(lang: Lang): string[] {
  return dicts[lang]['common.weekdaysShort']?.split(',') ?? dicts.uz['common.weekdaysShort']!.split(',');
}
export function shortMonths(lang: Lang): string[] {
  return dicts[lang]['common.monthsShort']?.split(',') ?? dicts.uz['common.monthsShort']!.split(',');
}
