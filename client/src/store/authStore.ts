import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../api/auth';
import { User } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setUser: (user) => set({ user }),

      logout: () => {
        const { refreshToken } = get();
        if (refreshToken) {
          authApi.logout(refreshToken).catch(() => {/* fire-and-forget */});
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) throw new Error('No refresh token');
        const res = await authApi.refresh(refreshToken);
        set({
          user: res.data.user,
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken,
          isAuthenticated: true,
        });
      },
    }),
    {
      name: 'nba-auth',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
