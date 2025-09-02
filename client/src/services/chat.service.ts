import api from "../lib/axios";

export const fetchChatRooms = async () => {
  const res = await api.get("/api/chats");
  return res.data; // array of chat rooms
};

export const createOrGetChatRoom = async (recipientId: string) => {
  const res = await api.post("/api/chats", { recipientId });
  return res.data; 
};

export const fetchChatMessages = async (chatRoomId: string) => {
  const res = await api.get(`/api/chats/${chatRoomId}/messages`);
  return res.data; // array of messages
};