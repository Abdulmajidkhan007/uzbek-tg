/**
 * Chat ekrani uchun formatlash yordamchilari: sana ajratkichi, "oxirgi marta
 * onlayn", ko'rishlar soni, ism ranglari.
 */
import { format, isSameYear, isToday, isYesterday } from 'date-fns';
import type { Translator } from '@/i18n';
import type { UserPreview } from '@/stores/chat.store';

function monthName(tr: Translator, d: Date): string {
  const months = tr('common.monthsLong').split(',');
  return months[d.getMonth()] ?? '';
}

/** "Bugun", "Kecha", "14-oktabr", "2024-yil 3-mart". */
export function dateSeparatorLabel(tr: Translator, date: Date): string {
  if (isToday(date)) return tr('common.today');
  if (isYesterday(date)) return tr('common.yesterday');
  const params = { d: date.getDate(), month: monthName(tr, date), y: date.getFullYear() };
  return isSameYear(date, new Date()) ? tr('chat.date.dayMonth', params) : tr('chat.date.dayMonthYear', params);
}

/** Shaxsiy chat sarlavhasi ostidagi holat matni. */
export function userStatusLabel(tr: Translator, u: UserPreview | undefined): string {
  if (!u) return '';
  if (u.isBot) return tr('chat.bot');
  if (u.status === 'online') return tr('chat.online');
  if (u.status === 'recently') return tr('chat.lastSeenRecently');
  if (u.status === 'last_seen' && u.wasOnline) {
    const d = new Date(u.wasOnline * 1000);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return tr('chat.lastSeenJustNow');
    if (diffMin < 60) return tr.p('chat.lastSeenMinutes', diffMin);
    const time = format(d, 'HH:mm');
    if (isToday(d)) return tr('chat.lastSeenToday', { time });
    if (isYesterday(d)) return tr('chat.lastSeenYesterday', { time });
    return tr('chat.lastSeenDate', { date: dateSeparatorLabel(tr, d) });
  }
  if (u.statusDetail === 'lastWeek') return tr('chat.lastSeenWeek');
  if (u.statusDetail === 'lastMonth') return tr('chat.lastSeenMonth');
  return tr('chat.lastSeenLongAgo');
}

/** 1234 → "1.2K", 1500000 → "1.5M" (Telegram uslubi). */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.floor(v)}K`;
  }
  const v = n / 1_000_000;
  return `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.floor(v)}M`;
}

/** Telegram'ning 7 ta asosiy ism rangi (accent_color_id 0..6). */
const NAME_COLORS_DARK = ['#FF8E86', '#FFA357', '#B18FFF', '#4FD35F', '#45E8D1', '#7AC8FF', '#FF7FD5'];
const NAME_COLORS_LIGHT = ['#CC5049', '#D67722', '#955CDB', '#40A920', '#309EBA', '#368AD1', '#C7508B'];

export function nameColor(colorId: number | undefined, isDark: boolean, fallback: string): string {
  if (colorId == null) return fallback;
  const list = isDark ? NAME_COLORS_DARK : NAME_COLORS_LIGHT;
  return list[((colorId % 7) + 7) % 7] ?? fallback;
}
