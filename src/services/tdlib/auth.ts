/**
 * Telegram'ga kirish oqimi: telefon → kod → (bo'lsa) 2FA parol → (yangi
 * akkaunt bo'lsa) ism. Holat TDLib'dan updateAuthorizationState orqali keladi
 * va useAuthStore'ga yoziladi; ekranlar shu holatga qarab yuradi.
 */
import { useAuthStore, type AuthUser } from '@/stores/auth.store';
import { onTdUpdate, resetTdlib, startTdlib, td, TdError } from './client';
import type { TdAuthState, TdObject, TdUser } from './types';
import { startChatSync, stopChatSync } from './chats';
import { fileUri, onFilesChanged, requestFile } from './files';
import { t } from '@/i18n';

const STATE_MAP: Record<string, TdAuthState> = {
  authorizationStateWaitTdlibParameters: 'loading',
  authorizationStateWaitPhoneNumber: 'waitPhoneNumber',
  authorizationStateWaitCode: 'waitCode',
  authorizationStateWaitPassword: 'waitPassword',
  authorizationStateWaitRegistration: 'waitRegistration',
  authorizationStateWaitEmailAddress: 'waitOther',
  authorizationStateWaitEmailCode: 'waitOther',
  authorizationStateWaitOtherDeviceConfirmation: 'waitOther',
  authorizationStateReady: 'ready',
  authorizationStateLoggingOut: 'loggingOut',
  authorizationStateClosing: 'loggingOut',
  authorizationStateClosed: 'closed',
};

/** Kod qayerga yuborilgani (OTP ekrani shu kalit bo'yicha matn tanlaydi). */
const CODE_TYPE_LABEL: Record<string, string> = {
  authenticationCodeTypeTelegramMessage: 'Telegram',
  authenticationCodeTypeSms: 'SMS',
  authenticationCodeTypeSmsWord: 'SMS',
  authenticationCodeTypeSmsPhrase: 'SMS',
  authenticationCodeTypeCall: 'call',
  authenticationCodeTypeFlashCall: 'call',
  authenticationCodeTypeMissedCall: 'call',
  authenticationCodeTypeFragment: 'Fragment',
};

let myId = 0;
let meUser: TdUser | null = null;
let myBio: string | undefined;
let unsubscribe: (() => void) | null = null;
let firstState: (() => void) | null = null;

export function toAuthUser(u: TdUser): AuthUser {
  return {
    id: String(u.id),
    phone: u.phone_number ? `+${u.phone_number}` : '',
    firstName: u.first_name,
    lastName: u.last_name || undefined,
    username: u.usernames?.active_usernames[0],
    avatarUrl: fileUri(u.profile_photo?.small),
    isVerified: false,
  };
}

function publishMe(): void {
  if (meUser) useAuthStore.setState({ currentUser: { ...toAuthUser(meUser), bio: myBio } });
}

function handleUpdate(update: TdObject): void {
  if (update['@type'] === 'updateAuthorizationState') {
    void applyAuthState(update.authorization_state as TdObject);
  } else if (update['@type'] === 'updateConnectionState') {
    const t = (update.state as TdObject)['@type'];
    useAuthStore.setState({
      connection:
        t === 'connectionStateReady'
          ? 'ready'
          : t === 'connectionStateUpdating'
          ? 'updating'
          : t === 'connectionStateWaitingForNetwork'
          ? 'waitingForNetwork'
          : 'connecting',
    });
  } else if (update['@type'] === 'updateUser') {
    const user = update.user as TdUser;
    if (user.id === myId) {
      meUser = user;
      publishMe();
      requestFile(user.profile_photo?.small);
    }
  } else if (update['@type'] === 'updateUserFullInfo' && update.user_id === myId) {
    myBio = (update.user_full_info as { bio?: { text: string } }).bio?.text || undefined;
    publishMe();
  }
}

async function applyAuthState(state: TdObject): Promise<void> {
  const tdState = STATE_MAP[state['@type']] ?? 'waitOther';
  const patch: Partial<ReturnType<typeof useAuthStore.getState>> = { tdState };

  if (tdState === 'waitCode') {
    const info = state.code_info as { type: { '@type': string; length?: number } };
    patch.codeLength = info.type.length ?? 5;
    patch.codeSentVia = CODE_TYPE_LABEL[info.type['@type']] ?? '';
  }
  if (tdState === 'waitPassword') {
    patch.passwordHint = String(state.password_hint ?? '');
  }
  if (tdState !== 'ready') {
    patch.isAuthenticated = false;
  }
  useAuthStore.setState(patch);

  if (tdState === 'ready') {
    const me = await td<TdUser & TdObject>({ '@type': 'getMe' });
    myId = me.id;
    meUser = me;
    useAuthStore.setState({ currentUser: toAuthUser(me), isAuthenticated: true });
    requestFile(me.profile_photo?.small);
    td<TdObject & { bio?: { text: string } }>({ '@type': 'getUserFullInfo', user_id: me.id })
      .then((full) => {
        myBio = full.bio?.text || undefined;
        publishMe();
      })
      .catch(() => undefined);
    startChatSync();
  } else if (tdState === 'closed') {
    // logOut tugadi: eski instance yopildi, kirish ekrani uchun yangisini ochamiz.
    stopChatSync();
    myId = 0;
    meUser = null;
    myBio = undefined;
    useAuthStore.setState({ currentUser: null });
    resetTdlib();
    void startTdlib();
  }

  if (tdState !== 'loading' && firstState) {
    firstState();
    firstState = null;
  }
}

/** TDLib'ni ishga tushiradi; birinchi aniq avtorizatsiya holatigacha kutadi. */
export async function startAuth(): Promise<void> {
  if (!unsubscribe) {
    unsubscribe = onTdUpdate(handleUpdate);
    // Avatar yuklab bo'lingach profilni yangilash.
    onFilesChanged(() => {
      publishMe();
    });
  }
  const known = new Promise<void>((resolve) => {
    firstState = resolve;
  });
  try {
    await startTdlib();
  } catch (e) {
    firstState = null;
    useAuthStore.setState({ startError: e instanceof Error ? e.message : String(e) });
    return;
  }
  // Tarmoq sekin bo'lsa ham splash abadiy qolmasin.
  await Promise.race([known, new Promise<void>((r) => setTimeout(r, 15000))]);
}

/** TDLib xatosini foydalanuvchiga ko'rsatiladigan matnga aylantiradi. */
export function authErrorText(e: unknown): string {
  if (!(e instanceof TdError)) return String(e);
  const m = e.message;
  if (m.includes('PHONE_NUMBER_INVALID')) return t('main.authErr.phoneInvalid');
  if (m.includes('PHONE_CODE_INVALID')) return t('main.authErr.codeInvalid');
  if (m.includes('PHONE_CODE_EXPIRED')) return t('main.authErr.codeExpired');
  if (m.includes('PASSWORD_HASH_INVALID')) return t('main.authErr.passwordInvalid');
  if (m.includes('FLOOD_WAIT') || e.code === 429) return t('main.authErr.flood');
  if (m.includes('PHONE_NUMBER_BANNED')) return t('main.authErr.banned');
  if (m.includes('FIRSTNAME_INVALID')) return t('main.authErr.firstNameInvalid');
  if (/network|connection/i.test(m)) return t('main.authErr.network');
  return m;
}

export async function sendPhoneNumber(phone: string): Promise<void> {
  await td({
    '@type': 'setAuthenticationPhoneNumber',
    phone_number: phone,
    settings: { '@type': 'phoneNumberAuthenticationSettings' },
  });
}

export async function sendCode(code: string): Promise<void> {
  await td({ '@type': 'checkAuthenticationCode', code });
}

export async function resendCode(): Promise<void> {
  await td({ '@type': 'resendAuthenticationCode' });
}

export async function sendPassword(password: string): Promise<void> {
  await td({ '@type': 'checkAuthenticationPassword', password });
}

export async function registerUser(firstName: string, lastName: string): Promise<void> {
  await td({ '@type': 'registerUser', first_name: firstName, last_name: lastName });
}

export async function logOut(): Promise<void> {
  await td({ '@type': 'logOut' });
}
