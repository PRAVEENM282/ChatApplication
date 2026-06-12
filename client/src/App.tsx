import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthProvider";
import { SocketProvider } from "./context/SocketProvider";
import { AuthPage } from "./features/auth/pages/AuthPage";
import { ChatPage } from "./features/chat/pages/ChatPage";
import CryptoRoundtripTest from "./tests/CryptoRoundtripTest";
import { PresenceProvider } from "./context/PresenceProvider";
import { ProfilePage } from "./features/profile/pages/ProfilePage";

/**
 * Route protection wrapper. Restricts route access to authenticated users.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

/**
 * Auth redirection wrapper. Automatically navigates logged-in users away from authentication pages.
 */
const AuthRedirector = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
};

/**
 * Main Client Application Entry Point.
 * Resolves routing, handles private routing, and mounts context providers.
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Real-time authenticated Chat room layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <SocketProvider>
                  <PresenceProvider>
                    <ChatPage />
                  </PresenceProvider>
                </SocketProvider>
              </ProtectedRoute>
            }
          />
          
          {/* User profile & device session management page */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          
          {/* Authentication portal (Register/Login Form) */}
          <Route
            path="/auth"
            element={
              <AuthRedirector>
                <AuthPage />
              </AuthRedirector>
            }
          />
          
          {/* Client-side sodium validation test dashboard */}
          <Route path="/crypto-test" element={<CryptoRoundtripTest />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;