// src/context/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useEffect,
} from "react";
import { useAuthStore } from "../store/authStore";

// Define the shape of the context's value
interface AuthContextType {
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

// Create the context with an initial undefined value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, isAuthenticated, login, logout } = useAuthStore();

  // Use useMemo to prevent re-creating the context value on every render
  const authContextValue = useMemo(
    () => ({
      accessToken,
      isAuthenticated,
      login,
      logout,
    }),
    [accessToken, isAuthenticated, login, logout]
  );

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook for easy access to the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};