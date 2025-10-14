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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem("accessToken")
  );
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      if (accessToken) {
        try {
          const userData = await getMe();
          setUser(userData);
        } catch (error) {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        Loading session...
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