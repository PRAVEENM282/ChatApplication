import {create} from 'zustand';

interface User {
  _id: string;
  username: string;
}

interface ChatRoom {
  _id: string;
  participants: User[];
  lastMessage?: any;
}

interface ChatState {
  selectedChat: ChatRoom | null;
  selectedChatUser: User | null;
  setSelectedChat: (chat: ChatRoom | null) => void;
  setSelectedChatUser: (user: User | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  selectedChat: null,
  selectedChatUser: null,
  setSelectedChat: (chat) => set({ selectedChat: chat }),
  setSelectedChatUser: (user) => set({ selectedChatUser: user }),
}));