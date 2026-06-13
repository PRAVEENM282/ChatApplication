import api from "../lib/axios";
import { ChatRoom, Message } from "../types/chat.types";

/**
 * Fetches all active chat rooms/conversations the user is part of.
 */
export const getMyChatRooms = async (): Promise<ChatRoom[]> => {
  const { data } = await api.get("/api/chats");
  return data;
};

/**
 * Fetches historical messages inside a specific conversation room.
 */
export const getChatMessages = async (
  chatroomId: string
): Promise<Message[]> => {
  const { data } = await api.get(`/api/chats/${chatroomId}/messages`);
  return data;
};

/**
 * Establishes a new chatroom with a recipient user.
 */
export const createChatRoom = async (
  recipientId: string
): Promise<ChatRoom> => {
  const { data } = await api.post<ChatRoom>("/api/chats", { recipientId });
  return data;
};

export const createGroupChat = async (
  name: string,
  participantIds: string[]
): Promise<ChatRoom> => {
  const { data } = await api.post<ChatRoom>("/api/chats/groups", {
    name,
    participantIds,
  });
  return data;
};

export const updateChatPreferences = async (
  chatRoomId: string,
  preferences: {
    muted?: boolean;
    archived?: boolean;
    readReceipts?: boolean;
  }
): Promise<ChatRoom> => {
  const { data } = await api.patch<ChatRoom>(
    `/api/chats/${chatRoomId}/preferences`,
    preferences
  );
  return data;
};

export const updateGroupChat = async (
  chatRoomId: string,
  updates: { name?: string; avatarUrl?: string }
): Promise<ChatRoom> => {
  const { data } = await api.patch<ChatRoom>(
    `/api/chats/${chatRoomId}/group`,
    updates
  );
  return data;
};

/**
 * Uploads a group avatar image via S3. Only group admins can call this.
 */
export const uploadGroupAvatar = async (
  chatRoomId: string,
  formData: FormData
): Promise<ChatRoom> => {
  const { data } = await api.put<ChatRoom>(
    `/api/chats/${chatRoomId}/group/avatar`,
    formData
  );
  return data;
};

export const addGroupMembers = async (
  chatRoomId: string,
  participantIds: string[]
): Promise<ChatRoom> => {
  const { data } = await api.post<ChatRoom>(
    `/api/chats/${chatRoomId}/group/members`,
    { participantIds }
  );
  return data;
};

export const leaveGroupChat = async (chatRoomId: string): Promise<void> => {
  await api.post(`/api/chats/${chatRoomId}/group/leave`);
};

/**
 * Marks all messages in a chatroom as read by updating server unread maps.
 */
export const markChatAsRead = async (chatRoomId: string): Promise<void> => {
  await api.put(`/api/chats/${chatRoomId}/read`);
};

/**
 * Deletes a chatroom and all its messages permanently.
 */
export const deleteChatRoom = async (chatRoomId: string): Promise<void> => {
  await api.delete(`/api/chats/${chatRoomId}`);
};

/**
 * Uploads multi-chunk encrypted file payload to S3 upload pipeline.
 * Fixes route path matching to /api/chats/:chatroomId/upload.
 */
export const sendEncryptedFile = async (
  formData: FormData,
  chatroomId: string
) => {
  const res = await api.post(`/api/chats/${chatroomId}/upload`, formData);

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      "File upload failed: " + (res.data?.message || "Unknown error")
    );
  }

  return res.data;
};
