/**
 * Sozlamalar ekranlari uchun TDLib chaqiruvlari: maxfiylik qoidalari,
 * ikki bosqichli parol, seanslar, bildirishnoma doiralari, akkaunt.
 * Barcha metod va maydonlar td_api.tl (TDLib 1.8.68) bo'yicha tekshirilgan.
 */
import { td, TdError } from './client';
import type { TdObject } from './types';
import type { PrivacySettingKey } from '@/navigation/types';

// ---------------------------------------------------------------------------
// Maxfiylik qoidalari
// ---------------------------------------------------------------------------

export const PRIVACY_TD_TYPE: Record<PrivacySettingKey, string> = {
  showStatus: 'userPrivacySettingShowStatus',
  showProfilePhoto: 'userPrivacySettingShowProfilePhoto',
  showPhoneNumber: 'userPrivacySettingShowPhoneNumber',
  showBio: 'userPrivacySettingShowBio',
  showBirthdate: 'userPrivacySettingShowBirthdate',
  allowFindingByPhoneNumber: 'userPrivacySettingAllowFindingByPhoneNumber',
  allowChatInvites: 'userPrivacySettingAllowChatInvites',
  allowCalls: 'userPrivacySettingAllowCalls',
  showLinkInForwardedMessages: 'userPrivacySettingShowLinkInForwardedMessages',
  allowPrivateVoiceAndVideoNoteMessages: 'userPrivacySettingAllowPrivateVoiceAndVideoNoteMessages',
};

export interface PrivacyRule extends TdObject {
  user_ids?: number[];
  chat_ids?: number[];
}

export type PrivacyBase = 'everybody' | 'contacts' | 'nobody';

export interface PrivacySummary {
  base: PrivacyBase;
  /** "Doim ruxsat" istisnolari: foydalanuvchilar + chatlar soni. */
  allowCount: number;
  /** "Hech qachon" istisnolari. */
  restrictCount: number;
}

/** Asosiy (istisno bo'lmagan) qoidalar — tanlov o'zgarganda almashtiriladi. */
const BASE_RULES = new Set([
  'userPrivacySettingRuleAllowAll',
  'userPrivacySettingRuleAllowContacts',
  'userPrivacySettingRuleRestrictAll',
]);

export async function getPrivacyRules(key: PrivacySettingKey): Promise<PrivacyRule[]> {
  const r = await td<TdObject & { rules: PrivacyRule[] }>({
    '@type': 'getUserPrivacySettingRules',
    setting: { '@type': PRIVACY_TD_TYPE[key] },
  });
  return r.rules ?? [];
}

export function summarizeRules(rules: PrivacyRule[]): PrivacySummary {
  // Qoidalar tartib bo'yicha tekshiriladi; birinchi mos kelgan asosiy qoida — natija.
  let base: PrivacyBase = 'nobody';
  for (const r of rules) {
    if (r['@type'] === 'userPrivacySettingRuleAllowAll') {
      base = 'everybody';
      break;
    }
    if (r['@type'] === 'userPrivacySettingRuleAllowContacts') {
      base = 'contacts';
      break;
    }
    if (r['@type'] === 'userPrivacySettingRuleRestrictAll') {
      base = 'nobody';
      break;
    }
  }
  let allowCount = 0;
  let restrictCount = 0;
  for (const r of rules) {
    const n = (r.user_ids?.length ?? 0) + (r.chat_ids?.length ?? 0);
    if (r['@type'] === 'userPrivacySettingRuleAllowUsers' || r['@type'] === 'userPrivacySettingRuleAllowChatMembers') {
      allowCount += n;
    } else if (
      r['@type'] === 'userPrivacySettingRuleRestrictUsers' ||
      r['@type'] === 'userPrivacySettingRuleRestrictChatMembers'
    ) {
      restrictCount += n;
    }
  }
  return {
    base,
    allowCount: base === 'everybody' ? 0 : allowCount,
    restrictCount: base === 'nobody' ? 0 : restrictCount,
  };
}

/** Asosiy tanlovni o'zgartiradi; istisnolar va boshqa qoidalar saqlanib qoladi. */
export async function setPrivacyBase(key: PrivacySettingKey, current: PrivacyRule[], base: PrivacyBase): Promise<PrivacyRule[]> {
  const kept = current.filter((r) => !BASE_RULES.has(r['@type']));
  const baseRule: PrivacyRule = {
    '@type':
      base === 'everybody'
        ? 'userPrivacySettingRuleAllowAll'
        : base === 'contacts'
        ? 'userPrivacySettingRuleAllowContacts'
        : 'userPrivacySettingRuleRestrictAll',
  };
  const rules = [...kept, baseRule];
  await td({
    '@type': 'setUserPrivacySettingRules',
    setting: { '@type': PRIVACY_TD_TYPE[key] },
    rules: { '@type': 'userPrivacySettingRules', rules },
  });
  return rules;
}

// ---------------------------------------------------------------------------
// Ikki bosqichli tekshiruv
// ---------------------------------------------------------------------------

export interface PasswordState {
  has_password: boolean;
  password_hint: string;
  has_recovery_email_address: boolean;
  recovery_email_address_code_info?: { email_address_pattern: string; length: number } | null;
  pending_reset_date: number;
}

export function getPasswordState(): Promise<PasswordState> {
  return td<TdObject & PasswordState>({ '@type': 'getPasswordState' });
}

export function setPassword(p: {
  oldPassword: string;
  newPassword: string;
  hint?: string;
  email?: string;
}): Promise<PasswordState> {
  return td<TdObject & PasswordState>({
    '@type': 'setPassword',
    old_password: p.oldPassword,
    new_password: p.newPassword,
    new_hint: p.hint ?? '',
    set_recovery_email_address: !!p.email,
    new_recovery_email_address: p.email ?? '',
  });
}

export function setRecoveryEmail(password: string, email: string): Promise<PasswordState> {
  return td<TdObject & PasswordState>({
    '@type': 'setRecoveryEmailAddress',
    password,
    new_recovery_email_address: email,
  });
}

export function checkRecoveryEmailCode(code: string): Promise<PasswordState> {
  return td<TdObject & PasswordState>({ '@type': 'checkRecoveryEmailAddressCode', code });
}

export function resendRecoveryEmailCode(): Promise<PasswordState> {
  return td<TdObject & PasswordState>({ '@type': 'resendRecoveryEmailAddressCode' });
}

export async function cancelPasswordReset(): Promise<void> {
  await td({ '@type': 'cancelPasswordReset' });
}

// ---------------------------------------------------------------------------
// Xavfsizlik: avto-o'chirish, akkaunt muddati, bloklanganlar
// ---------------------------------------------------------------------------

export async function getDefaultAutoDelete(): Promise<number> {
  const r = await td<TdObject & { time: number }>({ '@type': 'getDefaultMessageAutoDeleteTime' });
  return r.time ?? 0;
}

export async function setDefaultAutoDelete(seconds: number): Promise<void> {
  await td({
    '@type': 'setDefaultMessageAutoDeleteTime',
    message_auto_delete_time: { '@type': 'messageAutoDeleteTime', time: seconds },
  });
}

export async function getAccountTtl(): Promise<number> {
  const r = await td<TdObject & { days: number }>({ '@type': 'getAccountTtl' });
  return r.days;
}

export async function setAccountTtl(days: number): Promise<void> {
  await td({ '@type': 'setAccountTtl', ttl: { '@type': 'accountTtl', days } });
}

export async function getBlockedCount(): Promise<number> {
  const r = await td<TdObject & { total_count: number }>({
    '@type': 'getBlockedMessageSenders',
    block_list: { '@type': 'blockListMain' },
    offset: 0,
    limit: 1,
  });
  return r.total_count ?? 0;
}

// ---------------------------------------------------------------------------
// Seanslar (qurilmalar)
// ---------------------------------------------------------------------------

export interface TdSession {
  id: string;
  is_current: boolean;
  is_password_pending: boolean;
  is_unconfirmed: boolean;
  application_name: string;
  application_version: string;
  is_official_application: boolean;
  device_model: string;
  platform: string;
  system_version: string;
  log_in_date: number;
  last_active_date: number;
  ip_address: string;
  location: string;
  device_type: { '@type': string };
}

export async function getSessions(): Promise<{ sessions: TdSession[]; ttlDays: number }> {
  const r = await td<TdObject & { sessions: TdSession[]; inactive_session_ttl_days: number }>({
    '@type': 'getActiveSessions',
  });
  return { sessions: r.sessions ?? [], ttlDays: r.inactive_session_ttl_days };
}

export async function terminateSession(id: string): Promise<void> {
  await td({ '@type': 'terminateSession', session_id: id });
}

export async function terminateOtherSessions(): Promise<void> {
  await td({ '@type': 'terminateAllOtherSessions' });
}

export async function setInactiveSessionTtl(days: number): Promise<void> {
  await td({ '@type': 'setInactiveSessionTtl', inactive_session_ttl_days: days });
}

// ---------------------------------------------------------------------------
// Bildirishnoma doiralari
// ---------------------------------------------------------------------------

export type NotifScope = 'private' | 'group' | 'channel';

export const SCOPE_TD_TYPE: Record<NotifScope, string> = {
  private: 'notificationSettingsScopePrivateChats',
  group: 'notificationSettingsScopeGroupChats',
  channel: 'notificationSettingsScopeChannelChats',
};

export interface ScopeSettings {
  mute_for: number;
  sound_id: string;
  show_preview: boolean;
  use_default_mute_stories: boolean;
  mute_stories: boolean;
  story_sound_id: string;
  show_story_poster: boolean;
  disable_pinned_message_notifications: boolean;
  disable_mention_notifications: boolean;
}

/** "Abadiy o'chirish" — TDLib'dagi maksimal mute_for. */
export const MUTE_FOREVER = 2147483647;

export async function getScopeSettings(scope: NotifScope): Promise<ScopeSettings> {
  const r = await td<TdObject & ScopeSettings>({
    '@type': 'getScopeNotificationSettings',
    scope: { '@type': SCOPE_TD_TYPE[scope] },
  });
  return {
    mute_for: r.mute_for,
    sound_id: String(r.sound_id ?? '0'),
    show_preview: r.show_preview,
    use_default_mute_stories: r.use_default_mute_stories,
    mute_stories: r.mute_stories,
    story_sound_id: String(r.story_sound_id ?? '0'),
    show_story_poster: r.show_story_poster,
    disable_pinned_message_notifications: r.disable_pinned_message_notifications,
    disable_mention_notifications: r.disable_mention_notifications,
  };
}

/** To'liq scopeNotificationSettings obyekti yuboriladi (o'zgargan maydon bilan). */
export async function setScopeSettings(scope: NotifScope, s: ScopeSettings): Promise<void> {
  await td({
    '@type': 'setScopeNotificationSettings',
    scope: { '@type': SCOPE_TD_TYPE[scope] },
    notification_settings: { '@type': 'scopeNotificationSettings', ...s },
  });
}

export async function resetAllNotificationSettings(): Promise<void> {
  await td({ '@type': 'resetAllNotificationSettings' });
}

// ---------------------------------------------------------------------------
// TDLib option'lari
// ---------------------------------------------------------------------------

export async function getOptionValue(name: string): Promise<boolean | number | string | null> {
  const r = await td<TdObject & { value?: unknown }>({ '@type': 'getOption', name });
  if (r['@type'] === 'optionValueEmpty') return null;
  if (r['@type'] === 'optionValueInteger') return Number(r.value);
  if (r['@type'] === 'optionValueBoolean') return Boolean(r.value);
  return String(r.value ?? '');
}

export async function setBooleanOption(name: string, value: boolean): Promise<void> {
  await td({ '@type': 'setOption', name, value: { '@type': 'optionValueBoolean', value } });
}

// ---------------------------------------------------------------------------
// Akkaunt
// ---------------------------------------------------------------------------

export interface Birthdate {
  day: number;
  month: number;
  /** 0 — yil ko'rsatilmagan. */
  year: number;
}

export async function getMyBirthdate(userId: string): Promise<Birthdate | null> {
  const full = await td<TdObject & { birthdate?: Birthdate | null }>({
    '@type': 'getUserFullInfo',
    user_id: Number(userId),
  });
  return full.birthdate ? { day: full.birthdate.day, month: full.birthdate.month, year: full.birthdate.year } : null;
}

export async function setMyBirthdate(b: Birthdate | null): Promise<void> {
  if (b) await td({ '@type': 'setBirthdate', birthdate: { '@type': 'birthdate', ...b } });
  else await td({ '@type': 'setBirthdate' });
}

export async function setMyName(firstName: string, lastName: string): Promise<void> {
  await td({ '@type': 'setName', first_name: firstName, last_name: lastName });
}

export async function setMyBio(bio: string): Promise<void> {
  await td({ '@type': 'setBio', bio });
}

export async function setMyUsername(username: string): Promise<void> {
  await td({ '@type': 'setUsername', username });
}

export type UsernameCheck = 'ok' | 'invalid' | 'occupied' | 'purchasable' | 'tooMany' | 'other';

export async function checkMyUsername(userId: string, username: string): Promise<UsernameCheck> {
  // O'zim bilan shaxsiy chat id'si = user id; avval chat ma'lum bo'lishi kerak.
  const chat = await td<TdObject & { id: number }>({ '@type': 'createPrivateChat', user_id: Number(userId), force: true });
  const r = await td({ '@type': 'checkChatUsername', chat_id: chat.id, username });
  switch (r['@type']) {
    case 'checkChatUsernameResultOk':
      return 'ok';
    case 'checkChatUsernameResultUsernameInvalid':
      return 'invalid';
    case 'checkChatUsernameResultUsernameOccupied':
      return 'occupied';
    case 'checkChatUsernameResultUsernamePurchasable':
      return 'purchasable';
    case 'checkChatUsernameResultPublicChatsTooMany':
      return 'tooMany';
    default:
      return 'other';
  }
}

export async function setProfilePhotoFromUri(uri: string): Promise<void> {
  await td({
    '@type': 'setProfilePhoto',
    photo: {
      '@type': 'inputChatPhotoStatic',
      photo: { '@type': 'inputFileLocal', path: uri.replace('file://', '') },
    },
    is_public: false,
  });
}

/** TdError xabaridan "FLOOD_WAIT" kabi kodni ajratadi. */
export function errorText(e: unknown): string {
  if (e instanceof TdError || e instanceof Error) return e.message;
  return String(e);
}
