import api from "../lib/axios";
import { ChatRoom, Message } from "../types/chat.types";
export const getMyChatRooms = async (): Promise<ChatRoom[]> => {
  const { data } = await api.get("/api/chats");
  return data;
};

export const getChatMessages = async (
  chatroomId: string
): Promise<Message[]> => {
  const { data } = await api.get(`/api/chats/${chatroomId}/messages`);
  return data;
};
export const createChatRoom = async (
  recipientId: string
): Promise<ChatRoom> => {
  const { data } = await api.post<ChatRoom>("/api/chats", { recipientId });
  return data;
};

export const markChatAsRead = async (chatRoomId: string): Promise<void> => {
  await api.put(`/api/chats/${chatRoomId}/read`);
};

export const sendEncryptedFile = async (
  formData: FormData,
  chatroomId: string
) => {
  const res = await api.post(`/api/chats/${chatroomId}/files`, formData);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      "File upload failed: " + (res.data?.message || "Unknown error")
    );
  }

  return res.data;
};