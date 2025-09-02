import {create} from 'zustand';

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
  logout: () => {
    set({ accessToken: null, isAuthenticated: false });
    localStorage.removeItem("accessToken");
    // We will later call the backend's /logout endpoint here
  },
}));