import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useSocket } from "./SocketProvider";

interface PresenceContextType {
  onlineUsers: Set<string>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(
  undefined
);

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const socket = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!socket) return;

    socket.on("online_users", (users: string[]) => {
      setOnlineUsers(new Set(users));
    });

    socket.on("user_online", (userId: string) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });

    socket.on("user_offline", (userId: string) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    return () => {
      socket.off("online_users");
      socket.off("user_online");
      socket.off("user_offline");
    };
  }, [socket]);

  return (
    <PresenceContext.Provider value={{ onlineUsers }}>
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
};