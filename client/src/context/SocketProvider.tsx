import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { socket } from "../lib/socket"; 
import { useAuth } from "./AuthProvider";

const SocketContext = createContext(socket);

export const useSocket = () => {
  return useContext(SocketContext);
};

/**
 * Socket Connection Lifecycle Provider.
 * Automatically initiates or terminates connection to the real-time server
 * depending on authentication status. Passes the JWT Access Token in auth payload.
 */
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, isAuthenticated } = useAuth();

  useEffect(() => {
    // Authenticate and open socket connections only when user is logged in
    if (isAuthenticated && accessToken) {
      socket.auth = { token: accessToken };
      socket.connect();

      // Update token on reconnect attempts to avoid stale credentials
      const handleReconnectAttempt = () => {
        const currentToken = localStorage.getItem("accessToken");
        if (currentToken) {
          socket.auth = { token: currentToken };
        }
      };

      // Log connection errors
      const handleConnectError = (err: Error) => {
        console.error("Socket connection error:", err.message);
      };

      socket.io.on("reconnect_attempt", handleReconnectAttempt);
      socket.on("connect_error", handleConnectError);

      return () => {
        socket.io.off("reconnect_attempt", handleReconnectAttempt);
        socket.off("connect_error", handleConnectError);
        socket.disconnect();
      };
    }
    
    // Clean up socket listener connection on logout/unmount
    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};