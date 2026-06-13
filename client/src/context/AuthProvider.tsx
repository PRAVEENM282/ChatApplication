import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useMemo,
  useEffect,
  useCallback, 
} from "react";
import { User } from "../types/user.types";
import { getMe } from "../services/user.service";

interface AuthContextType {
  accessToken: string | null;
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (newUser: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Context Provider. Orchestrates local storage tokens,
 * fetches user metadata on refresh, and tracks login state.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem("accessToken")
  );
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Sync token state and fetch full user details on mounting
  useEffect(() => {
    const initializeAuth = async () => {
      if (accessToken) {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch (error) {
          // Token is invalid/expired: purge local session
          localStorage.removeItem("accessToken");
          setAccessToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, [accessToken]); 

  const login = useCallback(async (token: string) => {
    localStorage.setItem("accessToken", token);
    setAccessToken(token); 
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem("accessToken");
    // Clear private keys from localStorage during logout for maximum safety
    localStorage.removeItem("privateKey");
  }, []);

  const updateUser = useCallback((newUserData: User) => {
    setUser(newUserData);
  }, []);

  const authContextValue = useMemo(
    () => ({
      accessToken,
      isAuthenticated: !!accessToken && !!user,
      user,
      isLoading,
      login,
      logout,
      updateUser,
    }),
    [accessToken, user, isLoading, login, logout, updateUser] 
  );

  // Render a polished premium loading spinner while initializing sessions
  if (isLoading) {
    return (
      <div className="min-h-screen bg-wa-dark flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-wa-unread/30 border-t-wa-unread rounded-full animate-spin"></div>
        <div className="text-wa-text-secondary font-medium tracking-wide animate-pulse">
          Resuming Secure Session...
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};