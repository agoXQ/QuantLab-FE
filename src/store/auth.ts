import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: number | null;
  isAuthenticated: boolean;
  login: (tokens: { access_token: string; refresh_token: string; user_id: number }) => void;
  logout: () => void;
}

// Token is kept in memory + localStorage (MVP). Production should move
// to httpOnly cookies; the interceptor already reads from this store.
export const useTokenStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      isAuthenticated: false,
      login: (t) =>
        set({
          accessToken: t.access_token,
          refreshToken: t.refresh_token,
          userId: t.user_id,
          isAuthenticated: true,
        }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, userId: null, isAuthenticated: false }),
    }),
    { name: 'quantlab-auth' },
  ),
);
