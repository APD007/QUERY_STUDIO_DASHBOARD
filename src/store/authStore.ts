import { create } from 'zustand';
import { authApi, type AuthUser } from '@/lib/apiClient';

type Status = 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  status: Status;
  error: string | null;
  checkSession(): Promise<void>;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'checking',
  error: null,

  async checkSession() {
    try {
      const user = await authApi.me();
      set({ user, status: 'authenticated', error: null });
    } catch {
      set({ user: null, status: 'anonymous' });
    }
  },

  async login(email, password) {
    set({ error: null });
    try {
      const user = await authApi.login(email, password);
      set({ user, status: 'authenticated' });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  async register(email, password) {
    set({ error: null });
    try {
      const user = await authApi.register(email, password);
      set({ user, status: 'authenticated' });
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  async logout() {
    await authApi.logout().catch(() => {});
    set({ user: null, status: 'anonymous' });
  },
}));
