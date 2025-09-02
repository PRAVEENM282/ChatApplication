import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthProvider"; // 👈 Import the provider
import { AuthPage } from "./features/auth/pages/AuthPage";
import { SocketProvider } from "./context/SocketProvider";
import ChatsPage from "./features/chat/pages/ChatPage";
const HomePage = () => {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white">
      <h1 className="text-4xl font-bold mb-6">Welcome to the Home Page</h1>
      <button
        onClick={logout}
        className="px-6 py-3 rounded bg-blue-600 text-white text-lg font-semibold hover:bg-blue-700 transition"
      >
        Logout
      </button>
    </div>
  );
};



const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};

const AuthRedirector = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
};

function App() {
  return (
    // 👇 Wrap your application with the AuthProvider
    <AuthProvider>
      <SocketProvider>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
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
        </Routes>
      </Router>
    </SocketProvider>
  </AuthProvider>
  );
}

export default App;
