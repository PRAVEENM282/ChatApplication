import React, { createContext, useContext, useEffect, ReactNode } from "react";
import { socket } from "../lib/socket"; 
import { useAuth } from "./AuthProvider";
const SocketContext = createContext(socket);
export const useSocket = () => {
  return useContext(SocketContext);
};
export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { accessToken, isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      socket.auth = { token: accessToken };
      socket.connect();
    }
    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, accessToken]);
  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};