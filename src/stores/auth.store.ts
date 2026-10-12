import { create } from 'zustand';
import type { TdAuthState } from '@/services/tdlib/types';

export interface AuthUser {
  id: string;
  phone: string;
  username?: string;
  firstName: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string;
  isVerified: boolean;
}

interface AuthState {
  /** TDLib authorizationState (qisqartirilgan). Haqiqat manbai — TDLib. */
  tdState: TdAuthState;
  /** TDLib ishga tushmasa: 'NO_API_KEYS' yoki xato matni. */
  startError: string | null;
  /** Kutilayotgan kod uzunligi va qayerga yuborilgani (authorizationStateWaitCode). */
  codeLength: number;
  codeSentVia: string;
  passwordHint: string;
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setCurrentUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  tdState: 'loading',
  startError: null,
  codeLength: 5,
  codeSentVia: '',
  passwordHint: '',
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setCurrentUser: (user) => set({ currentUser: user }),

  logout: async () => {
    const { logOut } = await import('@/services/tdlib/auth');
    await logOut();
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

/** TDLib'ni ishga tushiradi va avtorizatsiya holati aniqlanguncha kutadi. */
export async function initAuthStore(): Promise<void> {
  const { startAuth } = await import('@/services/tdlib/auth');
  try {
    await startAuth();
  } finally {
    useAuthStore.setState({ isLoading: false });
  }
}
