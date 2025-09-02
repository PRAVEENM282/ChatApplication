import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Set<string>; // Storing user IDs
  setOnlineUsers: (userIds: string[]) => void;
  addUser: (userId: string) => void;
  removeUser: (userId: string) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: new Set(),
  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),
  addUser: (userId) => set((state) => ({ onlineUsers: new Set(state.onlineUsers).add(userId) })),
  removeUser: (userId) => set((state) => {
    const newOnlineUsers = new Set(state.onlineUsers);
    newOnlineUsers.delete(userId);
    return { onlineUsers: newOnlineUsers };
  }),
}));
