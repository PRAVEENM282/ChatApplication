import {create} from 'zustand';
import api from '../lib/axios';

interface AuthState {
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem("accessToken"),
  isAuthenticated: !!localStorage.getItem("accessToken"),
  login: (token: string) => {
    set({ accessToken: token, isAuthenticated: true });
    localStorage.setItem("accessToken", token);
  },
  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      set({ accessToken: null, isAuthenticated: false });
      localStorage.removeItem("accessToken");
      localStorage.removeItem("username");
      localStorage.removeItem("userId");
    }
  },
}));