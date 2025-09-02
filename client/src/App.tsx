import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthProvider";
import { AuthPage } from "./features/auth/pages/AuthPage";
import { SocketProvider } from "./context/SocketProvider";
import ChatsPage from "./features/chat/pages/ChatPage";
import api, { setCsrfToken } from "./lib/axios";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const AuthRedirector = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/chat" replace /> : <>{children}</>;
};

function App() {
  // Fetch CSRF token on initial application load
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const { data } = await api.get('/api/csrf-token');
        setCsrfToken(data.csrfToken);
        console.log("CSRF Token Set");
      } catch (error) {
        console.error("Failed to fetch CSRF token:", error);
      }
    };
    fetchCsrfToken();
  }, []);

  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Routes>
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auth"
              element={
                <AuthRedirector>
                  <AuthPage />
                </AuthRedirector>
              }
            />
            <Route path="*" element={<Navigate to="/chat" />} />
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;