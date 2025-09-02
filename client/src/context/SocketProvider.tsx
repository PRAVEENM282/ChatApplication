import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthProvider";
import { usePresenceStore } from "../store/presenceStore"; // Import presence store

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const { setOnlineUsers, addUser, removeUser } = usePresenceStore(); // Get actions from presence store

  useEffect(() => {
    if (!accessToken) {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
      return;
    }

    const newSocket = io("http://localhost:3000", {
      auth: { token: accessToken },
      withCredentials: true,
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket connection error:", err.message);
      if (err.message === "Authentication error") {
        logout();
      }
    });

    // --- PRESENCE EVENT LISTENERS ---
    newSocket.on('online_users', (userIds: string[]) => {
      setOnlineUsers(userIds);
    });

    newSocket.on('user_online', (userId: string) => {
      addUser(userId);
    });

    newSocket.on('user_offline', (userId: string) => {
      removeUser(userId);
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('online_users');
      newSocket.off('user_online');
      newSocket.off('user_offline');
      newSocket.disconnect();
    };
  }, [accessToken, logout, setOnlineUsers, addUser, removeUser]);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context.socket;
};
